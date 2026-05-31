import { getSql } from "./connection";
import type { Actor } from "./types";

export type RecipientProfile = {
  profileId: string;
  displayName: string;
  email: string;
  phone: string;
  passcode: string;
  active: boolean;
  emailOptIn: boolean;
  smsOptIn: boolean;
  escalationOptIn: boolean;
  dailyPriorityOptIn: boolean;
};

const defaultProfiles: RecipientProfile[] = [
  {
    profileId: "shiv",
    displayName: "Dr. Shiv",
    email: "",
    phone: "",
    passcode: "",
    active: true,
    emailOptIn: false,
    smsOptIn: false,
    escalationOptIn: false,
    dailyPriorityOptIn: false
  },
  {
    profileId: "raj",
    displayName: "Dr. Raj",
    email: "",
    phone: "",
    passcode: "",
    active: true,
    emailOptIn: false,
    smsOptIn: false,
    escalationOptIn: false,
    dailyPriorityOptIn: false
  }
];

const profileKeyPrefix = "recipient_profile:";

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function boolOrDefault(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeProfile(value: unknown, fallback: RecipientProfile): RecipientProfile {
  const input = value && typeof value === "object"
    ? value as Partial<RecipientProfile>
    : {};
  return {
    profileId: fallback.profileId,
    displayName: cleanText(input.displayName) || fallback.displayName,
    email: cleanText(input.email) || fallback.email,
    phone: cleanText(input.phone) || fallback.phone,
    passcode: cleanText(input.passcode) || fallback.passcode,
    active: boolOrDefault(input.active, fallback.active),
    emailOptIn: boolOrDefault(input.emailOptIn, fallback.emailOptIn),
    smsOptIn: boolOrDefault(input.smsOptIn, fallback.smsOptIn),
    escalationOptIn: boolOrDefault(input.escalationOptIn, fallback.escalationOptIn),
    dailyPriorityOptIn: boolOrDefault(input.dailyPriorityOptIn, fallback.dailyPriorityOptIn)
  };
}

function fallbackProfile(profileId: string, value: unknown): RecipientProfile {
  const input = value && typeof value === "object"
    ? value as Partial<RecipientProfile>
    : {};
  return {
    profileId,
    displayName: cleanText(input.displayName) || "Veterinarian",
    email: "",
    phone: "",
    passcode: "",
    active: true,
    emailOptIn: false,
    smsOptIn: false,
    escalationOptIn: false,
    dailyPriorityOptIn: false
  };
}

function profileKey(profileId: string) {
  return `${profileKeyPrefix}${profileId}`;
}

export async function isPriorityAlertsEnabled() {
  const sql = getSql();
  const rows = await sql<{ value: string }[]>`
    select value
    from app_settings
    where key = 'priority_alerts_enabled'
    limit 1
  `;
  return rows[0]?.value === "true";
}

export async function listRecipientProfiles(options?: { includeInactive?: boolean }) {
  const sql = getSql();
  const rows = await sql<{ key: string; value: string }[]>`
    select key, value
    from app_settings
    where key like ${`${profileKeyPrefix}%`}
  `;
  const byId = new Map<string, unknown>();
  for (const row of rows) {
    const profileId = row.key.replace(profileKeyPrefix, "");
    try {
      byId.set(profileId, JSON.parse(row.value));
    } catch {
      byId.set(profileId, null);
    }
  }
  const profiles = defaultProfiles.map((profile) =>
    normalizeProfile(byId.get(profile.profileId), profile)
  );
  const defaultIds = new Set(defaultProfiles.map((profile) => profile.profileId));
  for (const [profileId, value] of byId.entries()) {
    if (defaultIds.has(profileId)) continue;
    profiles.push(normalizeProfile(value, fallbackProfile(profileId, value)));
  }
  return profiles
    .filter((profile) => options?.includeInactive !== false || profile.active)
    .sort((left, right) => {
      const leftDefault = defaultProfiles.findIndex((profile) => profile.profileId === left.profileId);
      const rightDefault = defaultProfiles.findIndex((profile) => profile.profileId === right.profileId);
      if (leftDefault !== -1 || rightDefault !== -1) {
        return (leftDefault === -1 ? 99 : leftDefault) - (rightDefault === -1 ? 99 : rightDefault);
      }
      return left.displayName.localeCompare(right.displayName);
    });
}

export async function getRecipientProfile(profileId: string) {
  const profiles = await listRecipientProfiles();
  return profiles.find((profile) => profile.profileId === profileId) ?? null;
}

export async function getRecipientProfileByPasscode(passcode: string | undefined) {
  const clean = cleanText(passcode);
  if (!clean) return null;
  const profiles = await listRecipientProfiles({ includeInactive: false });
  return profiles.find((profile) => profile.passcode === clean) ?? null;
}

export async function setRecipientProfile(
  profile: RecipientProfile,
  actor: Actor
) {
  const existing =
    (await getRecipientProfile(profile.profileId)) ??
    fallbackProfile(profile.profileId, profile);

  const normalized = normalizeProfile(profile, existing);
  const sql = getSql();
  const value = JSON.stringify(normalized);
  await sql`
    insert into app_settings (key, value, updated_by_name, updated_at)
    values (${profileKey(normalized.profileId)}, ${value}, ${actor.name}, now())
    on conflict (key) do update
      set value = excluded.value,
          updated_by_name = excluded.updated_by_name,
          updated_at = now()
  `;
  return normalized;
}

export async function deactivateRecipientProfile(profileId: string, actor: Actor) {
  const profile = await getRecipientProfile(profileId);
  if (!profile) throw new Error("Unknown recipient profile.");
  return setRecipientProfile({
    ...profile,
    active: false,
    emailOptIn: false,
    smsOptIn: false,
    escalationOptIn: false,
    dailyPriorityOptIn: false
  }, actor);
}

export async function setPriorityAlertsEnabled(enabled: boolean, actor: Actor) {
  const sql = getSql();
  const rows = await sql<{ value: string }[]>`
    insert into app_settings (key, value, updated_by_name, updated_at)
    values ('priority_alerts_enabled', ${enabled ? "true" : "false"}, ${actor.name}, now())
    on conflict (key) do update
      set value = excluded.value,
          updated_by_name = excluded.updated_by_name,
          updated_at = now()
    returning value
  `;
  return rows[0]?.value === "true";
}
