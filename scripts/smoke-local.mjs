#!/usr/bin/env node

const baseUrl = process.env.LOCAL_BASE_URL || "http://localhost:3000";
const now = Date.now();
const smokeUserAgent = `vetagent-smoke/${now}`;
const managerPasscode = process.env.VET_APP_ADMIN_PASSCODE || process.env.VET_ADMIN_PASSCODE || "";
const managerQuery = "role=admin&name=Local%20Smoke";

const checks = [
  { label: "arrival page", method: "GET", path: "/arrival", maxMs: 1500 },
  { label: "request page", method: "GET", path: "/request", maxMs: 1500 },
  { label: "staff agent page", method: "GET", path: "/staff/agent", maxMs: 1500 },
  { label: "approvals page", method: "GET", path: "/staff/approvals", maxMs: 1500 },
  {
    label: "mock clinic api",
    method: "GET",
    path: `/api/mock/clinic?${managerQuery}`,
    maxMs: 2500,
    skip: !managerPasscode,
    skipReason: "VET_APP_ADMIN_PASSCODE or VET_ADMIN_PASSCODE missing",
    headers: { "x-central-vet-passcode": managerPasscode }
  },
  {
    label: "check-in workflow",
    method: "POST",
    path: "/api/agent/checkin",
    maxMs: 6000,
    body: {
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I am outside for my appointment. Smoke ${now}.`
    }
  },
  {
    label: "records workflow",
    method: "POST",
    path: "/api/agent/records",
    maxMs: 6000,
    body: {
      clientName: "Hannah Kim",
      clientPhone: "(415) 555-0172",
      petName: "Maple",
      destination: "Bayview Animal Clinic",
      message: `Please send Maple's vaccine records to Bayview Animal Clinic. Smoke ${now}.`
    }
  },
  {
    label: "daily ops workflow",
    method: "POST",
    path: "/api/agent/daily-ops",
    maxMs: 7000,
    skip: !managerPasscode,
    skipReason: "VET_APP_ADMIN_PASSCODE or VET_ADMIN_PASSCODE missing",
    body: {
      actor: {
        name: "Local Smoke",
        role: "admin",
        passcode: managerPasscode
      }
    }
  }
];

function payloadSize(value) {
  if (!value) return 0;
  return Buffer.byteLength(value, "utf8");
}

async function runCheck(check) {
  if (check.skip) {
    return {
      ...check,
      skipped: true,
      status: "SKIP",
      ms: 0,
      bytes: 0,
      error: check.skipReason
    };
  }

  const started = performance.now();
  let response;
  let text = "";
  try {
    response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: {
        "user-agent": smokeUserAgent,
        ...(check.body ? { "content-type": "application/json" } : {}),
        ...(check.headers ?? {})
      },
      body: check.body ? JSON.stringify(check.body) : undefined
    });
    text = await response.text();
  } catch (error) {
    return {
      ...check,
      status: "ERR",
      ms: Math.round(performance.now() - started),
      bytes: 0,
      error: error instanceof Error ? error.message : "Request failed"
    };
  }

  const ms = Math.round(performance.now() - started);
  const ok = response.ok && ms <= check.maxMs;
  return {
    ...check,
    status: response.status,
    ms,
    bytes: payloadSize(text),
    ok,
    error: response.ok ? null : text.slice(0, 160)
  };
}

const results = [];
for (const check of checks) {
  results.push(await runCheck(check));
}

let failed = false;
for (const result of results) {
  const status = result.skipped ? "SKIP" : result.ok ? "PASS" : "FAIL";
  if (status === "FAIL") failed = true;
  const budget = result.skipped ? "" : `/${result.maxMs}ms`;
  const detail = result.error ? ` ${result.error}` : "";
  console.log(`${status} ${result.label}: ${result.status} ${result.ms}${budget} ${result.bytes}b${detail}`);
}

if (failed) {
  console.error(`Local smoke failed for ${baseUrl}`);
  process.exit(1);
}

console.log(`Local smoke passed for ${baseUrl}`);
