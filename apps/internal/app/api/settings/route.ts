import {
  deactivateRecipientProfile,
  getRecipientProfile,
  isPriorityAlertsEnabled,
  listRecipientProfiles,
  renameActorReferences,
  setRecipientProfile,
  setPriorityAlertsEnabled,
  type Actor
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateActor,
  authenticateActorFromQuery,
  actorSchema,
  canAdmin,
  dbError,
  logInfo,
  logWarn,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";
import { canUseNotificationSettings } from "../../lib/taskWorkflow";

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

const bodySchema = z.object({
  actor: actorSchema,
  priorityAlertsEnabled: z.boolean().optional(),
  profileName: z.string().trim().min(1).max(80).optional(),
  recipientProfile: profileSchema.optional(),
  deactivateProfileId: z.string().trim().max(80).optional()
});

function profileIdFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/^dr\.?\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `vet-${slug}` : `vet-${Date.now()}`;
}

function doctorName(name: string) {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

async function profilesForActor(actor: Actor, clinicId: string) {
  const profiles = await listRecipientProfiles({ clinicId, includeInactive: false });
  if (actor.role === "admin") return profiles;
  if (actor.role === "veterinarian" && actor.profileId) {
    return profiles.filter((profile) => profile.profileId === actor.profileId);
  }
  return [];
}

export async function GET(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(new URL(request.url), request, clinic);
    if ("response" in auth) {
      logWarn("settings_read_rejected", { reason: "unauthorized" });
      return auth.response;
    }
    if (!canUseNotificationSettings(auth.actor.role)) {
      logWarn("settings_read_rejected", { reason: "unauthorized" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }
    const actor = auth.actor;

    return NextResponse.json(
      {
        clinic,
        priorityAlertsEnabled: await isPriorityAlertsEnabled({ clinicId: clinic.clinicId }),
        recipientProfiles: await profilesForActor(actor, clinic.clinicId),
        canEditAllProfiles: actor.role === "admin",
        currentProfileId: actor.profileId ?? null
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "settings.read" });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }

    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(parsed.data.actor, request, clinic);
    if ("response" in auth) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return auth.response;
    }
    if (!canUseNotificationSettings(auth.actor.role)) {
      logWarn("settings_update_rejected", { reason: "unauthorized_or_invalid" });
      return NextResponse.json({ error: "Settings require Admin or Veterinarian." }, { status: 403 });
    }
    const actor = auth.actor;
    let priorityAlertsEnabled = await isPriorityAlertsEnabled({ clinicId: clinic.clinicId });
    if (typeof parsed.data.priorityAlertsEnabled === "boolean") {
      if (!canAdmin(actor.role)) {
        return NextResponse.json({ error: "Only Admin can change the end-of-day alert." }, { status: 403 });
      }
      priorityAlertsEnabled = await setPriorityAlertsEnabled(
        parsed.data.priorityAlertsEnabled,
        actor,
        { clinicId: clinic.clinicId }
      );
    }
    let updatedProfile = null;
    if (parsed.data.profileName) {
      if (actor.role !== "veterinarian" || !actor.profileId) {
        return NextResponse.json({ error: "Only veterinarians can change their own profile name." }, { status: 403 });
      }
      const existing = await getRecipientProfile(actor.profileId, { clinicId: clinic.clinicId });
      if (!existing) {
        return NextResponse.json({ error: "Veterinarian profile not found." }, { status: 404 });
      }
      const nextName = doctorName(parsed.data.profileName);
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
    if (parsed.data.recipientProfile) {
      const profileId =
        parsed.data.recipientProfile.profileId ||
        profileIdFromName(parsed.data.recipientProfile.displayName);
      const existing = await getRecipientProfile(profileId, { clinicId: clinic.clinicId });
      if (actor.role !== "admin" && actor.profileId !== profileId) {
        return NextResponse.json({ error: "Veterinarians can only edit their own profile." }, { status: 403 });
      }
      if (actor.role !== "admin" && !existing) {
        return NextResponse.json({ error: "Only Admin can add veterinarian profiles." }, { status: 403 });
      }
      const nextName = doctorName(parsed.data.recipientProfile.displayName);
      updatedProfile = await setRecipientProfile(
        {
          ...(existing ?? parsed.data.recipientProfile),
          ...parsed.data.recipientProfile,
          displayName: nextName,
          profileId,
          passcode:
            actor.role === "admin"
              ? parsed.data.recipientProfile.passcode
              : existing?.passcode ?? parsed.data.recipientProfile.passcode,
          active:
            actor.role === "admin"
              ? parsed.data.recipientProfile.active
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
    if (parsed.data.deactivateProfileId) {
      if (!canAdmin(actor.role)) {
        return NextResponse.json({ error: "Only Admin can deactivate veterinarian profiles." }, { status: 403 });
      }
      updatedProfile = await deactivateRecipientProfile(
        parsed.data.deactivateProfileId,
        actor,
        { clinicId: clinic.clinicId }
      );
    }
    logInfo("settings_updated", {
      actorRole: parsed.data.actor.role,
      priorityAlertsEnabled,
      profileId: updatedProfile?.profileId
    });
    return NextResponse.json(
      {
        priorityAlertsEnabled,
        recipientProfiles: await profilesForActor(actor, clinic.clinicId),
        canEditAllProfiles: actor.role === "admin",
        currentProfileId: actor.profileId ?? null
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "settings.update" });
  }
}
