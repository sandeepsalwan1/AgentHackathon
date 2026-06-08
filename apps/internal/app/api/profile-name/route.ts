import {
  getRecipientProfile,
  listRecipientProfiles,
  renameActorReferences,
  setRecipientProfile
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  actorSchema,
  authenticateActor,
  dbError,
  logInfo,
  logWarn,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";

const bodySchema = z.object({
  actor: actorSchema,
  name: z.string().trim().min(1).max(80)
});

function doctorName(name: string) {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

async function profilePayload(profileId: string | null | undefined, clinicId: string) {
  if (!profileId) return {};
  const profiles = await listRecipientProfiles({ clinicId, includeInactive: true });
  return {
    recipientProfiles: profiles.filter((profile) => profile.profileId === profileId),
    currentProfileId: profileId
  };
}

export async function PATCH(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      logWarn("profile_name_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }

    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActor(parsed.data.actor, request, clinic);
    if ("response" in auth) {
      logWarn("profile_name_rejected", { reason: "unauthorized", actorRole: parsed.data.actor.role });
      return auth.response;
    }

    const actor = auth.actor;
    const nextName = actor.role === "veterinarian"
      ? doctorName(parsed.data.name)
      : parsed.data.name;
    if (actor.role === "veterinarian" && actor.profileId) {
      const existing = await getRecipientProfile(actor.profileId, { clinicId: clinic.clinicId });
      if (!existing) {
        return NextResponse.json({ error: "Veterinarian profile not found." }, { status: 404 });
      }
      await setRecipientProfile(
        { ...existing, displayName: nextName },
        actor,
        { clinicId: clinic.clinicId }
      );
    }

    const rename = await renameActorReferences({
      actor,
      oldName: actor.name,
      newName: nextName,
      clinicId: clinic.clinicId
    });
    logInfo("profile_name_updated", {
      actorRole: actor.role,
      tasksUpdated: rename.tasksUpdated,
      eventsUpdated: rename.eventsUpdated
    });

    return NextResponse.json(
      {
        actor: { ...actor, name: nextName },
        previousName: actor.name,
        rename,
        ...(await profilePayload(actor.profileId, clinic.clinicId))
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "profile-name.update" });
  }
}
