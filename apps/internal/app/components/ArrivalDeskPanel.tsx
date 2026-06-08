"use client";

import type {
  ArrivalDeskSnapshot,
  ArrivalIntake,
  ArrivalQuestionnaire,
  ClinicRoom,
  RoomState
} from "@central-vet/db";
import {
  ClipboardCheck,
  DoorClosed,
  DoorOpen,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  SprayCan,
  Stethoscope
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { canAdmin } from "../lib/taskWorkflow";
import {
  checkoutArrivalRoomState,
  readArrivalDeskSnapshot,
  saveArrivalDeskSettings,
  updateArrivalRoomState
} from "./taskBoardClient";
import type { TaskBoardSession } from "./taskBoardTypes";

type Props = {
  session: TaskBoardSession;
  actorQuery: string;
  onError: (message: string) => void;
};

type SettingsDraft = ArrivalQuestionnaire & {
  roomAssignmentEnabled: boolean;
  visitReasonsText: string;
  sickSignsText: string;
};

const roomStates: { state: RoomState; label: string }[] = [
  { state: "open", label: "Open" },
  { state: "occupied", label: "Occupied" },
  { state: "cleaning", label: "Cleaning" },
  { state: "closed", label: "Closed" }
];

function compactList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function draftFromDesk(desk: ArrivalDeskSnapshot): SettingsDraft {
  const questionnaire = desk.settings.questionnaire;
  return {
    ...questionnaire,
    roomAssignmentEnabled: desk.settings.roomAssignmentEnabled,
    visitReasonsText: questionnaire.visitReasons.join(", "),
    sickSignsText: questionnaire.sickSigns.join(", ")
  };
}

function questionnaireFromDraft(draft: SettingsDraft): ArrivalQuestionnaire {
  return {
    visitReasons: compactList(draft.visitReasonsText),
    sickSignsLabel: draft.sickSignsLabel,
    sickSigns: compactList(draft.sickSignsText),
    specialConcernsLabel: draft.specialConcernsLabel,
    vaccineFeelingLabel: draft.vaccineFeelingLabel,
    surgeryAteLabel: draft.surgeryAteLabel,
    surgeryFeelingLabel: draft.surgeryFeelingLabel,
    dentalConcernLabel: draft.dentalConcernLabel,
    routineConcernLabel: draft.routineConcernLabel
  };
}

function roomIcon(state: RoomState) {
  if (state === "open") return DoorOpen;
  if (state === "cleaning") return SprayCan;
  return DoorClosed;
}

function answerSummary(arrival: ArrivalIntake) {
  const entries = Object.entries(arrival.answers ?? {});
  if (!entries.length) return "No answers";
  return entries
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return text ? `${key}: ${text}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

export function ArrivalDeskPanel({ session, actorQuery, onError }: Props) {
  const [desk, setDesk] = useState<ArrivalDeskSnapshot | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const arrivalsByRoom = useMemo(() => {
    const map = new Map<string, ArrivalIntake>();
    desk?.arrivals.forEach((arrival) => {
      if (arrival.roomId) map.set(arrival.roomId, arrival);
    });
    return map;
  }, [desk]);

  async function load() {
    if (!actorQuery || loading) return;
    setLoading(true);
    try {
      const snapshot = await readArrivalDeskSnapshot(session, actorQuery);
      setDesk(snapshot);
      setSettingsDraft(draftFromDesk(snapshot));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Arrivals failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const loadIfMounted = () => {
      if (!cancelled) void load();
    };
    const initialId = window.setTimeout(loadIfMounted, 0);
    const id = window.setInterval(() => {
      loadIfMounted();
    }, 20000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorQuery, session.passcode, session.role, session.name]);

  async function updateRoom(room: ClinicRoom, state: RoomState) {
    setSaving(true);
    try {
      await updateArrivalRoomState(session, room.id, state);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Room update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function checkout(arrivalId: string) {
    setSaving(true);
    try {
      await checkoutArrivalRoomState(session, arrivalId);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Checkout update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settingsDraft) return;
    setSaving(true);
    try {
      await saveArrivalDeskSettings(
        session,
        settingsDraft.roomAssignmentEnabled,
        questionnaireFromDraft(settingsDraft)
      );
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Settings save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="arrivalDeskPanel">
      <div className="arrivalDeskHeader">
        <div>
          <p className="eyebrow">Arrival Intake</p>
          <h2>Rooms and check-ins</h2>
        </div>
        <button className="plainButton compact" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="spinIcon" size={15} /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="arrivalRoomGrid">
        {(desk?.rooms ?? []).map((room) => {
          const Icon = roomIcon(room.state);
          const arrival = room.currentArrivalId ? arrivalsByRoom.get(room.id) : null;
          return (
            <article className={`arrivalRoomCard room-${room.state}`} key={room.id}>
              <div className="arrivalRoomTop">
                <Icon size={19} />
                <div>
                  <strong>{room.name}</strong>
                  <span>{room.state}</span>
                </div>
              </div>
              {arrival ? <p>{arrival.petName} · {arrival.visitReason}</p> : <p>No patient assigned</p>}
              <div className="arrivalRoomActions">
                {roomStates.map((item) => (
                  <button
                    key={item.state}
                    type="button"
                    className={room.state === item.state ? "selected" : ""}
                    disabled={saving}
                    onClick={() => void updateRoom(room, item.state)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="arrivalOpsGrid">
        <section className="arrivalListPanel">
          <div className="arrivalMiniHeader">
            <ClipboardCheck size={17} />
            <h3>Today</h3>
            <span>{desk?.arrivals.length ?? 0}</span>
          </div>
          <div className="arrivalList">
            {(desk?.arrivals ?? []).map((arrival) => (
              <article className={`arrivalListItem arrival-${arrival.status}`} key={arrival.id}>
                <div className="arrivalListTop">
                  <div>
                    <strong>{arrival.petName || "Unmatched pet"}</strong>
                    <span>{arrival.clientName || "Client"} · {arrival.clientPhone || "No phone"}</span>
                  </div>
                  <em>{arrival.status === "checked_in" ? arrival.roomName || "No room" : "Front desk"}</em>
                </div>
                <p>{arrival.status === "checked_in" ? answerSummary(arrival) : arrival.exceptionReason}</p>
                <div className="arrivalListActions">
                  <span><Stethoscope size={13} /> {arrival.visitReason || "Match needed"}</span>
                  {arrival.roomId && arrival.status === "checked_in" ? (
                    <button type="button" onClick={() => void checkout(arrival.id)} disabled={saving}>
                      Payment done
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {desk && desk.arrivals.length === 0 ? <div className="emptyLane">No arrivals yet</div> : null}
          </div>
        </section>

        {canAdmin(session.role) && settingsDraft ? (
          <form className="arrivalSettingsPanel" onSubmit={saveSettings}>
            <div className="arrivalMiniHeader">
              <Sparkles size={17} />
              <h3>Admin defaults</h3>
            </div>
            <label className="arrivalToggleLine">
              <input
                type="checkbox"
                checked={settingsDraft.roomAssignmentEnabled}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, roomAssignmentEnabled: event.target.checked })}
              />
              Auto-assign open rooms
            </label>
            <label>
              Visit reasons
              <input
                value={settingsDraft.visitReasonsText}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, visitReasonsText: event.target.value })}
              />
            </label>
            <label>
              Sick signs
              <input
                value={settingsDraft.sickSignsText}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, sickSignsText: event.target.value })}
              />
            </label>
            <label>
              Sick question
              <input value={settingsDraft.sickSignsLabel} onChange={(event) => setSettingsDraft({ ...settingsDraft, sickSignsLabel: event.target.value })} />
            </label>
            <label>
              Vaccines question
              <input value={settingsDraft.vaccineFeelingLabel} onChange={(event) => setSettingsDraft({ ...settingsDraft, vaccineFeelingLabel: event.target.value })} />
            </label>
            <label>
              Surgery food question
              <input value={settingsDraft.surgeryAteLabel} onChange={(event) => setSettingsDraft({ ...settingsDraft, surgeryAteLabel: event.target.value })} />
            </label>
            <button className="primaryButton" type="submit" disabled={saving}>
              {saving ? <Loader2 className="spinIcon" size={17} /> : <Save size={17} />}
              Save check-in form
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
