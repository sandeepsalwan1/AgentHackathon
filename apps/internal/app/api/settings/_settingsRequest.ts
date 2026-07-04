import {
  deactivateRecipientProfile,
  getRecipientProfile,
  isEndOfDayAlertsEnabled,
  listRecipientProfiles,
  renameActorReferences,
  setEndOfDayAlertsEnabled,
  setRecipientProfile,
  type Actor,
  type ClinicContext,
  type RecipientProfile
} from "@central-vet/db";
import { z } from "zod";
import { canAdmin } from "../../lib/taskWorkflow";
import { doctorName, profileIdFromName } from "../../lib/veterinarianProfile";
import { actorSchema } from "../_shared";

const profileSchema = z.object({
  profileId: z.string().trim().max(80).optional(),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().max(160),
  phone: z.string().trim().max(80),
  passcode: z.string().trim().min(4).max(20),
  active: z.boolean().optional().default(true),
  emailOptIn: z.boolean(),
  smsOptIn: z.boolean(),
  escalationOptIn: z.boolean(),
  dailyPriorityOptIn: z.boolean()
});

export const settingsPatchSchema = z.object({
  actor: actorSchema,
  endOfDayAlertsEnabled: z.boolean().optional(),
  profileName: z.string().trim().min(1).max(80).optional(),
  recipientProfile: profileSchema.optional(),
  deactivateProfileId: z.string().trim().max(80).optional()
});

type SettingsPatch = z.infer<typeof settingsPatchSchema>;

async function profilesForActor(actor: Actor, clinicId: string) {
  const profiles = await listRecipientProfiles({ clinicId, includeInactive: false });
  if (actor.role === "admin") return profiles;
  if (actor.role === "veterinarian" && actor.profileId) {
    return profiles.filter((profile) => profile.profileId === actor.profileId);
  }
  return [];
}

export async function settingsPayloadForActor(actor: Actor, clinic: ClinicContext) {
  return {
    clinic,
    endOfDayAlertsEnabled: await isEndOfDayAlertsEnabled({ clinicId: clinic.clinicId }),
    recipientProfiles: await profilesForActor(actor, clinic.clinicId),
    canEditAllProfiles: actor.role === "admin",
    currentProfileId: actor.profileId ?? null
  };
}

type SettingsUpdateResult =
  | {
      ok: true;
      payload: Omit<Awaited<ReturnType<typeof settingsPayloadForActor>>, "clinic">;
      logFields: {
        actorRole: Actor["role"];
        endOfDayAlertsEnabled: boolean;
        profileId?: string;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export async function applySettingsPatch(
  actor: Actor,
  clinic: ClinicContext,
  patch: SettingsPatch
): Promise<SettingsUpdateResult> {
  let endOfDayAlertsEnabled = await isEndOfDayAlertsEnabled({ clinicId: clinic.clinicId });
  if (typeof patch.endOfDayAlertsEnabled === "boolean") {
    if (!canAdmin(actor.role)) {
      return { ok: false, error: "Only Admin can change the end-of-day alert.", status: 403 };
    }
    endOfDayAlertsEnabled = await setEndOfDayAlertsEnabled(
      patch.endOfDayAlertsEnabled,
      actor,
      { clinicId: clinic.clinicId }
    );
  }

  let updatedProfile: RecipientProfile | null = null;
  if (patch.profileName) {
    if (actor.role !== "veterinarian" || !actor.profileId) {
      return { ok: false, error: "Only veterinarians can change their own profile name.", status: 403 };
    }
    const existing = await getRecipientProfile(actor.profileId, { clinicId: clinic.clinicId });
    if (!existing) {
      return { ok: false, error: "Veterinarian profile not found.", status: 404 };
    }
    const nextName = doctorName(patch.profileName);
    updatedProfile = await setRecipientProfile(
      {
        ...existing,
        displayName: nextName
      },
      actor,
      { clinicId: clinic.clinicId }
    );
    await renameActorReferences({
      actor,
      oldName: actor.name,
      newName: nextName,
      clinicId: clinic.clinicId
    });
  }

  if (patch.recipientProfile) {
    const profileId =
      patch.recipientProfile.profileId ||
      profileIdFromName(patch.recipientProfile.displayName);
    const existing = await getRecipientProfile(profileId, { clinicId: clinic.clinicId });
    if (actor.role !== "admin" && actor.profileId !== profileId) {
      return { ok: false, error: "Veterinarians can only edit their own profile.", status: 403 };
    }
    if (actor.role !== "admin" && !existing) {
      return { ok: false, error: "Only Admin can add veterinarian profiles.", status: 403 };
    }
    const nextName = doctorName(patch.recipientProfile.displayName);
    updatedProfile = await setRecipientProfile(
      {
        ...(existing ?? patch.recipientProfile),
        ...patch.recipientProfile,
        displayName: nextName,
        profileId,
        passcode:
          actor.role === "admin"
            ? patch.recipientProfile.passcode
            : existing?.passcode ?? patch.recipientProfile.passcode,
        active:
          actor.role === "admin"
            ? patch.recipientProfile.active
            : existing?.active ?? true
      },
      actor,
      { clinicId: clinic.clinicId }
    );
    if (actor.role === "veterinarian" && existing && existing.displayName !== nextName) {
      await renameActorReferences({
        actor,
        oldName: existing.displayName,
        newName: nextName,
        clinicId: clinic.clinicId
      });
    }
  }

  if (patch.deactivateProfileId) {
    if (!canAdmin(actor.role)) {
      return { ok: false, error: "Only Admin can deactivate veterinarian profiles.", status: 403 };
    }
    updatedProfile = await deactivateRecipientProfile(
      patch.deactivateProfileId,
      actor,
      { clinicId: clinic.clinicId }
    );
  }

  return {
    ok: true,
    payload: {
      endOfDayAlertsEnabled,
      recipientProfiles: await profilesForActor(actor, clinic.clinicId),
      canEditAllProfiles: actor.role === "admin",
      currentProfileId: actor.profileId ?? null
    },
    logFields: {
      actorRole: actor.role,
      endOfDayAlertsEnabled,
      profileId: updatedProfile?.profileId
    }
  };
}
