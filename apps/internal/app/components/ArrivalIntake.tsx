"use client";

import type {
  ArrivalIntake as ArrivalRecord,
  ArrivalMatch,
  ArrivalQuestionnaire,
  ArrivalSettings
} from "@central-vet/db";
import {
  BadgeCheck,
  ClipboardCheck,
  DoorOpen,
  Loader2,
  Lock,
  LogIn,
  PawPrint,
  Phone,
  Send,
  Stethoscope,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSession } from "../lib/accountStore";
import { useClinicBrand } from "./ClinicContext";

type Step = "identity" | "questions" | "done" | "exception";

type IdentityState = {
  clientName: string;
  lastName: string;
  clientPhone: string;
  petName: string;
  loggedIn: boolean;
};

type AnswerState = {
  sickSigns: string[];
  otherSigns: string;
  specialConcerns: string;
  vaccineFeeling: string;
  surgeryAte: string;
  surgeryFeeling: string;
  dentalConcern: string;
  routineConcern: string;
};

type MatchResponse =
  | { matched: true; match: ArrivalMatch }
  | { matched: false; message: string; exception?: ArrivalRecord };

type SubmitResponse =
  | { matched: true; arrival: ArrivalRecord; message: string }
  | { matched: false; message: string; exception?: ArrivalRecord };

const fallbackQuestionnaire: ArrivalQuestionnaire = {
  visitReasons: ["Sick", "Vaccines", "Surgery", "Dental", "Routine"],
  sickSignsLabel: "What signs are you seeing?",
  sickSigns: ["Vomiting", "Diarrhea", "Coughing", "Other signs"],
  specialConcernsLabel: "Any special concerns?",
  vaccineFeelingLabel: "How is your pet feeling today?",
  surgeryAteLabel: "Did your pet eat today?",
  surgeryFeelingLabel: "How is your pet feeling today?",
  dentalConcernLabel: "Any dental concerns today?",
  routineConcernLabel: "Scratching, itching, routine vaccines, or anything else?"
};

const blankIdentity: IdentityState = {
  clientName: "",
  lastName: "",
  clientPhone: "",
  petName: "",
  loggedIn: false
};

const blankAnswers: AnswerState = {
  sickSigns: [],
  otherSigns: "",
  specialConcerns: "",
  vaccineFeeling: "",
  surgeryAte: "",
  surgeryFeeling: "",
  dentalConcern: "",
  routineConcern: ""
};

function lastName(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).at(-1) ?? "";
}

function formatPhoneInput(value: string) {
  if (value.includes("@")) return value;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const prefix = digits.length === 11 && digits.startsWith("1") ? "+1 " : "";
  if (local.length === 0) return "";
  if (local.length <= 3) return `${prefix}${local}`;
  if (local.length <= 6) return `${prefix}(${local.slice(0, 3)}) ${local.slice(3)}`;
  if (local.length <= 10) return `${prefix}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return value;
}

async function readJson<T>(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Check-in failed.");
  return data as T;
}

function inferVisitReason(appointmentType: string, options: string[]) {
  const lower = appointmentType.toLowerCase();
  const find = (needle: string) => options.find((option) => option.toLowerCase().includes(needle));
  if (/sick|ill|urgent/.test(lower)) return find("sick") ?? options[0];
  if (/vacc|shot|booster/.test(lower)) return find("vacc") ?? options[0];
  if (/surg|spay|neuter|procedure/.test(lower)) return find("surg") ?? options[0];
  if (/dental|tooth|teeth/.test(lower)) return find("dental") ?? options[0];
  return find("routine") ?? options[0];
}

function reasonKey(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("sick")) return "sick";
  if (lower.includes("vacc")) return "vaccines";
  if (lower.includes("surg")) return "surgery";
  if (lower.includes("dental")) return "dental";
  return "routine";
}

function railState(step: Step, target: number) {
  if (step === "exception") return target === 0 ? "active" : "";
  const index = step === "identity" ? 0 : step === "questions" ? 1 : 2;
  if (target < index) return "done";
  if (target === index) return step === "done" ? "done" : "active";
  return "";
}

function publicSettings(data: { settings?: ArrivalSettings }): ArrivalSettings {
  return {
    roomAssignmentEnabled: data.settings?.roomAssignmentEnabled ?? true,
    questionnaire: {
      ...fallbackQuestionnaire,
      ...(data.settings?.questionnaire ?? {})
    }
  };
}

export function ArrivalIntake() {
  const clinic = useClinicBrand();
  const [step, setStep] = useState<Step>("identity");
  const [settings, setSettings] = useState<ArrivalSettings>({
    roomAssignmentEnabled: true,
    questionnaire: fallbackQuestionnaire
  });
  const [identity, setIdentity] = useState<IdentityState>(blankIdentity);
  const [match, setMatch] = useState<ArrivalMatch | null>(null);
  const [visitReason, setVisitReason] = useState(fallbackQuestionnaire.visitReasons[0]);
  const [answers, setAnswers] = useState<AnswerState>(blankAnswers);
  const [arrival, setArrival] = useState<ArrivalRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const questionnaire = settings.questionnaire;
  const currentReasonKey = reasonKey(visitReason);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/arrival-intake", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          const resolved = publicSettings(data);
          setSettings(resolved);
          setVisitReason(resolved.questionnaire.visitReasons[0] ?? "Sick");
        }
      })
      .catch(() => undefined);

    const session = getSession();
    const autofillTimer = session?.role === "customer"
      ? window.setTimeout(() => {
          if (!cancelled) {
            setIdentity({
              clientName: session.name,
              lastName: lastName(session.name),
              clientPhone: session.phone ?? "",
              petName: session.petName ?? "",
              loggedIn: true
            });
          }
        }, 0)
      : null;
    return () => {
      cancelled = true;
      if (autofillTimer !== null) window.clearTimeout(autofillTimer);
    };
  }, []);

  const identityComplete = useMemo(() => {
    return Boolean(
      identity.lastName.trim().length >= 2 &&
      identity.clientPhone.replace(/\D/g, "").length >= 10 &&
      identity.petName.trim().length >= 2
    );
  }, [identity]);

  function updateIdentity(key: keyof IdentityState, value: string | boolean) {
    setIdentity((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateAnswer(key: keyof AnswerState, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function toggleSign(sign: string) {
    setAnswers((current) => ({
      ...current,
      sickSigns: current.sickSigns.includes(sign)
        ? current.sickSigns.filter((item) => item !== sign)
        : [...current.sickSigns, sign]
    }));
  }

  async function submitIdentity(event: FormEvent) {
    event.preventDefault();
    if (loading || !identityComplete) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await readJson<MatchResponse>(
        await fetch("/api/arrival-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "match",
            identity
          })
        })
      );
      if (!data.matched) {
        setMessage(data.message);
        setStep("exception");
        return;
      }
      setMatch(data.match);
      setVisitReason(inferVisitReason(data.match.appointmentType, questionnaire.visitReasons));
      setStep("questions");
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "Match failed.");
    } finally {
      setLoading(false);
    }
  }

  function answerPayload(): Record<string, unknown> {
    if (currentReasonKey === "sick") {
      return {
        signs: answers.sickSigns,
        otherSigns: answers.otherSigns,
        specialConcerns: answers.specialConcerns
      };
    }
    if (currentReasonKey === "vaccines") return { feelingToday: answers.vaccineFeeling };
    if (currentReasonKey === "surgery") {
      return {
        ateToday: answers.surgeryAte,
        feelingToday: answers.surgeryFeeling
      };
    }
    if (currentReasonKey === "dental") return { concerns: answers.dentalConcern };
    return { concerns: answers.routineConcern };
  }

  async function submitQuestions(event: FormEvent) {
    event.preventDefault();
    if (loading || !match) return;
    setLoading(true);
    setError("");
    try {
      const data = await readJson<SubmitResponse>(
        await fetch("/api/arrival-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            identity,
            visitReason,
            answers: answerPayload()
          })
        })
      );
      if (!data.matched) {
        setMessage(data.message);
        setStep("exception");
        return;
      }
      setArrival(data.arrival);
      setMessage(data.message);
      setStep("done");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Check-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="arrivalShell">
      <section className="arrivalHero">
        <div className="arrivalBrand">
          <PawPrint size={22} />
          <span>{clinic.name}</span>
        </div>
        <div className="arrivalHeroText">
          <p>Arrival</p>
          <h1>Check in before the front desk line.</h1>
        </div>
        <div className="arrivalStepRail" aria-label="Check-in steps">
          <span className={railState(step, 0)}>Match</span>
          <span className={railState(step, 1)}>Questions</span>
          <span className={railState(step, 2)}>Room</span>
        </div>
      </section>

      <section className="arrivalCard">
        {step === "identity" ? (
          <form className="arrivalForm" onSubmit={submitIdentity}>
            <div className="arrivalCardHeader">
              <UserRound size={22} />
              <div>
                <h2>Find today&apos;s appointment</h2>
                <p>Use the phone number on the clinic record.</p>
              </div>
            </div>
            {identity.loggedIn ? (
              <div className="arrivalLockedBox">
                <Lock size={17} />
                <span>{identity.clientName} · {identity.petName || "Pet"} · {identity.clientPhone || "Verified phone"}</span>
              </div>
            ) : (
              <a className="arrivalSignin" href="/">
                <LogIn size={16} />
                Sign in for autofill
              </a>
            )}
            <div className="arrivalGrid">
              <label>
                Last name
                <input
                  value={identity.lastName}
                  onChange={(event) => updateIdentity("lastName", event.target.value)}
                  autoFocus={!identity.loggedIn}
                  disabled={identity.loggedIn}
                />
              </label>
              <label>
                Phone
                <input
                  value={identity.clientPhone}
                  onChange={(event) => updateIdentity("clientPhone", formatPhoneInput(event.target.value))}
                  inputMode="tel"
                  disabled={identity.loggedIn}
                />
              </label>
              <label>
                Pet name
                <input
                  value={identity.petName}
                  onChange={(event) => updateIdentity("petName", event.target.value)}
                  disabled={identity.loggedIn && Boolean(identity.petName)}
                />
              </label>
            </div>
            {error ? <div className="errorBox">{error}</div> : null}
            <button className="arrivalPrimary" type="submit" disabled={loading || !identityComplete}>
              {loading ? <Loader2 className="spinIcon" size={18} /> : <BadgeCheck size={18} />}
              {loading ? "Matching" : "Continue"}
            </button>
          </form>
        ) : null}

        {step === "questions" && match ? (
          <form className="arrivalForm" onSubmit={submitQuestions}>
            <div className="arrivalCardHeader">
              <Stethoscope size={22} />
              <div>
                <h2>{match.petName}</h2>
                <p>{match.appointmentTime} · {match.appointmentType} · {match.doctor}</p>
              </div>
            </div>
            <fieldset className="arrivalReasonPicker">
              <legend>Visit reason</legend>
              {questionnaire.visitReasons.map((reason) => (
                <button
                  key={reason}
                  className={visitReason === reason ? "selected" : ""}
                  type="button"
                  onClick={() => setVisitReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </fieldset>

            {currentReasonKey === "sick" ? (
              <div className="arrivalQuestionBlock">
                <fieldset className="arrivalChecklist">
                  <legend>{questionnaire.sickSignsLabel}</legend>
                  {questionnaire.sickSigns.map((sign) => (
                    <label key={sign}>
                      <input
                        type="checkbox"
                        checked={answers.sickSigns.includes(sign)}
                        onChange={() => toggleSign(sign)}
                      />
                      <span>{sign}</span>
                    </label>
                  ))}
                </fieldset>
                <label>
                  Other signs
                  <textarea rows={3} value={answers.otherSigns} onChange={(event) => updateAnswer("otherSigns", event.target.value)} />
                </label>
                <label>
                  {questionnaire.specialConcernsLabel}
                  <textarea rows={4} value={answers.specialConcerns} onChange={(event) => updateAnswer("specialConcerns", event.target.value)} />
                </label>
              </div>
            ) : null}

            {currentReasonKey === "vaccines" ? (
              <label>
                {questionnaire.vaccineFeelingLabel}
                <textarea rows={4} value={answers.vaccineFeeling} onChange={(event) => updateAnswer("vaccineFeeling", event.target.value)} />
              </label>
            ) : null}

            {currentReasonKey === "surgery" ? (
              <div className="arrivalQuestionBlock">
                <label>
                  {questionnaire.surgeryAteLabel}
                  <input value={answers.surgeryAte} onChange={(event) => updateAnswer("surgeryAte", event.target.value)} />
                </label>
                <label>
                  {questionnaire.surgeryFeelingLabel}
                  <textarea rows={4} value={answers.surgeryFeeling} onChange={(event) => updateAnswer("surgeryFeeling", event.target.value)} />
                </label>
              </div>
            ) : null}

            {currentReasonKey === "dental" ? (
              <label>
                {questionnaire.dentalConcernLabel}
                <textarea rows={4} value={answers.dentalConcern} onChange={(event) => updateAnswer("dentalConcern", event.target.value)} />
              </label>
            ) : null}

            {currentReasonKey === "routine" ? (
              <label>
                {questionnaire.routineConcernLabel}
                <textarea rows={4} value={answers.routineConcern} onChange={(event) => updateAnswer("routineConcern", event.target.value)} />
              </label>
            ) : null}

            {error ? <div className="errorBox">{error}</div> : null}
            <button className="arrivalPrimary" type="submit" disabled={loading}>
              {loading ? <Loader2 className="spinIcon" size={18} /> : <Send size={18} />}
              {loading ? "Checking in" : "Check in"}
            </button>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="arrivalDone">
            <div className="arrivalDoneIcon">
              {arrival?.roomName ? <DoorOpen size={34} /> : <ClipboardCheck size={34} />}
            </div>
            <h2>{message}</h2>
            <p>{arrival?.pimsWriteSummary ? "Saved to the clinic workflow." : "Saved for the clinic team."}</p>
            <div className="arrivalDoneMeta">
              <span><PawPrint size={14} /> {arrival?.petName}</span>
              <span><Phone size={14} /> {arrival?.clientPhone}</span>
              {arrival?.roomName ? <span><DoorOpen size={14} /> {arrival.roomName}</span> : null}
            </div>
          </div>
        ) : null}

        {step === "exception" ? (
          <div className="arrivalDone arrivalException">
            <div className="arrivalDoneIcon">
              <UserRound size={34} />
            </div>
            <h2>{message || "Front desk help is ready."}</h2>
            <p>We saved your arrival so the clinic team can match the appointment.</p>
            <a className="arrivalSignin" href="/">
              <LogIn size={16} />
              Try signing in
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
