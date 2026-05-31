"use client";

import { CheckCircle2, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type FormState = {
  requestType: RequestType;
  clientName: string;
  clientPhone: string;
  clientDateOfBirth: string;
  petName: string;
  petWeight: string;
  request: string;
};

type RequestType = "prescription" | "labs_xrays" | "records_request" | "scheduling";
type FieldErrors = Partial<Record<keyof FormState, string>>;

const blank: FormState = {
  requestType: "scheduling",
  clientName: "",
  clientPhone: "",
  clientDateOfBirth: "",
  petName: "",
  petWeight: "",
  request: ""
};

const requestTypes: { value: RequestType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "labs_xrays", label: "Labs & X-Rays" },
  { value: "records_request", label: "Records Request" },
  { value: "scheduling", label: "Appointment" }
];

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Submission failed.") as Error & {
      fieldErrors?: FieldErrors;
    };
    error.fieldErrors = data.fieldErrors;
    throw error;
  }
  return data;
}

function requiredLabel(text: string) {
  return (
    <span className="labelText">
      {text} <span className="requiredStar">*</span>
    </span>
  );
}

function formatPhoneInput(value: string) {
  if (value.includes("@")) return value;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const prefix = digits.length === 11 && digits.startsWith("1") ? "+1 " : "";
  if (local.length === 0) return "";
  if (local.length <= 3) return `${prefix}${local}`;
  if (local.length <= 6) return `${prefix}(${local.slice(0, 3)}) ${local.slice(3)}`;
  if (local.length <= 10) {
    return `${prefix}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return value;
}

export function RequestForm() {
  const [form, setForm] = useState<FormState>(blank);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof FormState, value: string) => {
    setForm({ ...form, [key]: value } as FormState);
    setFieldErrors({ ...fieldErrors, [key]: undefined });
    setError("");
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      await readJson(
        await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        })
      );
      setDone(true);
      setForm(blank);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
        setFieldErrors((submitError as Error & { fieldErrors?: FieldErrors }).fieldErrors ?? {});
      } else {
        setError("Submission failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="requestShell">
      <section className="requestPanel">
        <div className="brandBlock">
          <p>Central Veterinary Hospital</p>
          <h1>Client Request</h1>
        </div>

        {done ? (
          <div className="successBox">
            <CheckCircle2 size={34} />
            <h2>Request received</h2>
            <p>Our clinic team will review it. For emergencies, call the hospital directly.</p>
            <button type="button" onClick={() => setDone(false)}>
              Submit another request
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <fieldset className="requestTypePicker">
              <legend>{requiredLabel("Request Type")}</legend>
              {requestTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={form.requestType === item.value ? "selected" : ""}
                  onClick={() => update("requestType", item.value)}
                >
                  {item.label}
                </button>
              ))}
              {fieldErrors.requestType ? <span className="fieldError">{fieldErrors.requestType}</span> : null}
            </fieldset>
            <div className="formGrid">
              <label>
                {requiredLabel("Your name")}
                <input
                  className={fieldErrors.clientName ? "fieldInvalid" : ""}
                  required
                  value={form.clientName}
                  onChange={(event) => update("clientName", event.target.value)}
                  autoFocus
                />
                {fieldErrors.clientName ? <span className="fieldError">{fieldErrors.clientName}</span> : null}
              </label>
              <label>
                {requiredLabel("Phone")}
                <input
                  className={fieldErrors.clientPhone ? "fieldInvalid" : ""}
                  required
                  value={form.clientPhone}
                  onChange={(event) => update("clientPhone", formatPhoneInput(event.target.value))}
                  inputMode="tel"
                />
                {fieldErrors.clientPhone ? <span className="fieldError">{fieldErrors.clientPhone}</span> : null}
              </label>
              <label>
                {requiredLabel("Pet's name")}
                <input
                  className={fieldErrors.petName ? "fieldInvalid" : ""}
                  required
                  value={form.petName}
                  onChange={(event) => update("petName", event.target.value)}
                />
                {fieldErrors.petName ? <span className="fieldError">{fieldErrors.petName}</span> : null}
              </label>
              <label>
                Pet&apos;s date of birth
                <input
                  className={fieldErrors.clientDateOfBirth ? "fieldInvalid" : ""}
                  type="date"
                  value={form.clientDateOfBirth}
                  onChange={(event) => update("clientDateOfBirth", event.target.value)}
                />
                {fieldErrors.clientDateOfBirth ? <span className="fieldError">{fieldErrors.clientDateOfBirth}</span> : null}
              </label>
              <label>
                Pet&apos;s weight
                <input
                  className={fieldErrors.petWeight ? "fieldInvalid" : ""}
                  value={form.petWeight}
                  onChange={(event) => update("petWeight", event.target.value)}
                />
                {fieldErrors.petWeight ? <span className="fieldError">{fieldErrors.petWeight}</span> : null}
              </label>
            </div>
            <label>
              {requiredLabel("Request")}
              <textarea
                className={fieldErrors.request ? "fieldInvalid" : ""}
                required
                rows={7}
                value={form.request}
                onChange={(event) => update("request", event.target.value)}
              />
              {fieldErrors.request ? <span className="fieldError">{fieldErrors.request}</span> : null}
            </label>
            {error ? <div className="errorBox">{error}</div> : null}
            <button className="sendButton" type="submit" disabled={submitting}>
              <Send size={18} />
              {submitting ? "Sending" : "Submit Request"}
            </button>
            <p className="requiredNote"><span className="requiredStar">*</span> Required</p>
          </form>
        )}
      </section>
    </main>
  );
}
