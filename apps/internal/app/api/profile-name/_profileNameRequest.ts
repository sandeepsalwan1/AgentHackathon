import {
  getRecipientProfile,
  listRecipientProfiles,
  renameActorReferences,
  setRecipientProfile,
  type Actor
} from "@central-vet/db";
import { z } from "zod";
import { doctorName } from "../../lib/veterinarianProfile";
import { actorSchema } from "../_shared";

export const profileNameBodySchema = z.object({
  actor: actorSchema,
  name: z.string().trim().min(1).max(80)
});

async function profilePayload(profileId: string | null | undefined, clinicId: string) {
  if (!profileId) return {};
  const profiles = await listRecipientProfiles({ clinicId, includeInactive: true });
  return {
    recipientProfiles: profiles.filter((profile) => profile.profileId === profileId),
    currentProfileId: profileId
  };
}

export async function applyProfileNameUpdate(args: {
  actor: Actor;
  clinicId: string;
  name: string;
}) {
  const nextName = args.actor.role === "veterinarian"
    ? doctorName(args.name)
    : args.name;

  if (args.actor.role === "veterinarian" && args.actor.profileId) {
    const existing = await getRecipientProfile(args.actor.profileId, { clinicId: args.clinicId });
    if (!existing) {
      return { ok: false as const, error: "Veterinarian profile not found.", status: 404 };
    }
    await setRecipientProfile(
      { ...existing, displayName: nextName },
      args.actor,
      { clinicId: args.clinicId }
    );
  }

  const rename = await renameActorReferences({
    actor: args.actor,
    oldName: args.actor.name,
    newName: nextName,
    clinicId: args.clinicId
  });

  return {
    ok: true as const,
    body: {
      actor: { ...args.actor, name: nextName },
      previousName: args.actor.name,
      rename,
      ...(await profilePayload(args.actor.profileId, args.clinicId))
    },
    logFields: {
      actorRole: args.actor.role,
      tasksUpdated: rename.tasksUpdated,
      eventsUpdated: rename.eventsUpdated
    }
  };
}
