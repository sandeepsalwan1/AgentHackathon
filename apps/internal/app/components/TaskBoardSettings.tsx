"use client";

import type { RecipientProfile } from "@central-vet/db";
import { UserX } from "lucide-react";
import { useState } from "react";

export const blankVeterinarianProfile: RecipientProfile = {
  profileId: "",
  displayName: "Dr. ",
  email: "",
  phone: "",
  passcode: "",
  active: true,
  emailOptIn: false,
  smsOptIn: false,
  escalationOptIn: false,
  dailyPriorityOptIn: false
};

type ProfileSettingsProps = {
  profile: RecipientProfile;
  saving: boolean;
  canEditAll: boolean;
  currentProfileId: string | null;
  onChange: (profile: RecipientProfile) => void;
  onDeactivate: (profile: RecipientProfile) => void;
  isNew?: boolean;
};

export function ProfileSettings({
  profile,
  saving,
  canEditAll,
  currentProfileId,
  onChange,
  onDeactivate,
  isNew = false
}: ProfileSettingsProps) {
  const [draft, setDraft] = useState(profile);
  const ownProfile = draft.profileId === currentProfileId;
  const canEdit = canEditAll || ownProfile || isNew;
  const update = (patch: Partial<RecipientProfile>) => {
    setDraft({ ...draft, ...patch });
  };
  const channelCount = Number(draft.emailOptIn) + Number(draft.smsOptIn);
  const alertCount = Number(draft.escalationOptIn) + Number(draft.dailyPriorityOptIn);
  const phoneDigits = draft.phone.replace(/\D/g, "");
  const smsReady = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1"));

  return (
    <section className={`profileSettings ${!draft.active ? "inactiveProfile" : ""}`}>
      <div className="profileHeader">
        <div>
          <strong>{draft.displayName || "New veterinarian"}</strong>
          <small>
            {draft.active ? "Active" : "Inactive"} · {channelCount}/2 channels · {alertCount}/2 alert types
          </small>
        </div>
        <span>{draft.escalationOptIn ? "Escalation on" : "Escalation off"}</span>
      </div>
      <div className="settingsGrid">
        <label>
          Profile name
          <input
            value={draft.displayName}
            disabled={saving || !canEdit}
            onChange={(event) => update({ displayName: event.target.value })}
            placeholder="Dr. Name"
          />
        </label>
        {canEditAll || isNew ? (
          <label>
            Login passcode
            <input
              value={draft.passcode}
              disabled={saving || !canEdit}
              onChange={(event) => update({ passcode: event.target.value })}
              placeholder="4+ digits"
              inputMode="numeric"
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            value={draft.email}
            disabled={saving || !canEdit}
            onChange={(event) => update({ email: event.target.value })}
            placeholder="email address"
          />
        </label>
        <label>
          Phone
          <input
            value={draft.phone}
            disabled={saving || !canEdit}
            onChange={(event) => update({ phone: event.target.value })}
            placeholder="10-digit number"
            inputMode="tel"
          />
          {draft.smsOptIn && !smsReady ? (
            <span className="fieldHint">SMS needs a 10-digit number.</span>
          ) : null}
        </label>
      </div>
      <div className="profileSubhead">Delivery channels</div>
      <div className="profileToggles">
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.emailOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ emailOptIn: event.target.checked })}
          />
          Email opt-in
        </label>
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.smsOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ smsOptIn: event.target.checked })}
          />
          SMS opt-in
        </label>
      </div>
      <div className="profileSubhead">Alert types</div>
      <div className="profileToggles">
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.escalationOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ escalationOptIn: event.target.checked })}
          />
          Escalation alerts
        </label>
        <label className="toggleLine">
          <input
            type="checkbox"
            checked={draft.dailyPriorityOptIn}
            disabled={saving || !canEdit}
            onChange={(event) => update({ dailyPriorityOptIn: event.target.checked })}
          />
          Daily medium/high alerts
        </label>
      </div>
      <div className="profileActions">
        <button
          type="button"
          className="plainButton compact"
          disabled={saving || !canEdit || !draft.displayName.trim() || !draft.passcode.trim()}
          onClick={() => void onChange(draft)}
        >
          Save settings
        </button>
        {canEditAll && !isNew && draft.active ? (
          <button
            type="button"
            className="plainButton compact dangerText"
            disabled={saving}
            onClick={() => void onDeactivate(draft)}
          >
            <UserX size={16} />
            Deactivate
          </button>
        ) : null}
      </div>
    </section>
  );
}
