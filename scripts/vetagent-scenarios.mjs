#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const mode = args.has("--e2b") || process.env.SCENARIO_MODE === "e2b" ? "e2b" : "local";
const baseUrl = process.env.SCENARIO_BASE_URL || process.env.LOCAL_BASE_URL || "http://localhost:3000";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const scenarioUserAgent = `vetagent-scenarios/${runId}`;
const managerPasscode = process.env.VET_APP_ADMIN_PASSCODE || process.env.VET_ADMIN_PASSCODE || "";

function managerActor() {
  return {
    name: "Scenario Runner",
    role: "admin",
    passcode: managerPasscode
  };
}

const scenarios = [
  {
    label: "arrival happy path",
    method: "POST",
    path: "/api/agent/checkin",
    maxMs: 7000,
    body: {
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I am outside for my appointment. Scenario ${runId}.`
    }
  },
  {
    label: "arrival no appointment",
    method: "POST",
    path: "/api/agent/checkin",
    maxMs: 7000,
    body: {
      clientName: "Tessa Novel",
      clientPhone: "(415) 555-0191",
      petName: "Moose",
      message: `I am here but I am not sure my appointment exists. Scenario ${runId}.`
    }
  },
  {
    label: "booking happy path",
    method: "POST",
    path: "/api/agent/booking",
    maxMs: 7000,
    body: {
      clientName: "Luis Rivera",
      clientPhone: "(415) 555-0199",
      petName: "Luna",
      appointmentType: "Vaccines",
      message: `Can I book vaccines next week after 3 if anything is open? Scenario ${runId}.`
    }
  },
  {
    label: "pickup status",
    method: "POST",
    path: "/api/agent/pickup",
    maxMs: 7000,
    body: {
      clientName: "Luis Rivera",
      clientPhone: "(415) 555-0199",
      petName: "Luna",
      message: `Is Luna ready for pickup yet? Scenario ${runId}.`
    }
  },
  {
    label: "records transfer",
    method: "POST",
    path: "/api/agent/records",
    maxMs: 7000,
    body: {
      clientName: "Hannah Kim",
      clientPhone: "(415) 555-0172",
      petName: "Maple",
      destination: "Bayview Animal Clinic",
      message: `Please send Maple's vaccine records to Bayview Animal Clinic. Scenario ${runId}.`
    }
  },
  {
    label: "sick pet escalation",
    method: "POST",
    path: "/api/agent/external",
    maxMs: 7000,
    body: {
      clientName: "Avery Johnson",
      clientPhone: "(415) 555-0108",
      petName: "Otis",
      message: `Otis is coughing and breathing harder than usual. I need help. Scenario ${runId}.`
    }
  },
  {
    label: "call transcript to task",
    method: "POST",
    path: "/api/agent/call",
    maxMs: 7000,
    body: {
      callerName: "Maya Parker",
      callerPhone: "(415) 555-0134",
      petName: "Biscuit",
      transcript: `Hi, this is Maya. I am outside for Biscuit's appointment and wanted to check in. Scenario ${runId}.`
    }
  },
  {
    label: "follow-up workflow",
    method: "POST",
    path: "/api/agent/followup",
    maxMs: 7000,
    body: {
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I got a vaccine reminder and want to know what is due. Scenario ${runId}.`
    }
  },
  {
    label: "daily ops",
    method: "POST",
    path: "/api/agent/daily-ops",
    maxMs: 9000,
    skip: !managerPasscode,
    skipReason: "manager passcode missing",
    body: { actor: managerActor() }
  },
  {
    label: "invoice review",
    method: "POST",
    path: "/api/agent/invoice",
    maxMs: 9000,
    skip: !managerPasscode,
    skipReason: "manager passcode missing",
    body: { actor: managerActor(), request: `Review invoice flags. Scenario ${runId}.` }
  },
  {
    label: "pricing review",
    method: "POST",
    path: "/api/agent/pricing",
    maxMs: 9000,
    skip: !managerPasscode,
    skipReason: "manager passcode missing",
    body: { actor: managerActor(), live: false, request: `Run pricing review. Scenario ${runId}.` }
  }
];

function isLocalhost(url) {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
}

function size(value) {
  return value ? Buffer.byteLength(value, "utf8") : 0;
}

async function runOne(check, fetchImpl = fetch) {
  if (check.skip) {
    return { label: check.label, status: "SKIP", ms: 0, bytes: 0, ok: true, error: check.skipReason };
  }
  const started = performance.now();
  try {
    const response = await fetchImpl(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: {
        "user-agent": scenarioUserAgent,
        ...(check.body ? { "content-type": "application/json" } : {})
      },
      body: check.body ? JSON.stringify(check.body) : undefined
    });
    const text = await response.text();
    const ms = Math.round(performance.now() - started);
    return {
      label: check.label,
      status: response.status,
      ms,
      maxMs: check.maxMs,
      bytes: size(text),
      ok: response.ok && ms <= check.maxMs,
      error: response.ok ? "" : text.slice(0, 180)
    };
  } catch (error) {
    return {
      label: check.label,
      status: "ERR",
      ms: Math.round(performance.now() - started),
      maxMs: check.maxMs,
      bytes: 0,
      ok: false,
      error: error instanceof Error ? error.message : "request failed"
    };
  }
}

function printResults(results, source) {
  let failed = false;
  for (const result of results) {
    const state = result.ok ? (result.status === "SKIP" ? "SKIP" : "PASS") : "FAIL";
    if (state === "FAIL") failed = true;
    const budget = result.maxMs ? `/${result.maxMs}ms` : "";
    const detail = result.error ? ` ${result.error}` : "";
    console.log(`${state} ${result.label}: ${result.status} ${result.ms}${budget} ${result.bytes}b${detail}`);
  }
  if (failed) {
    console.error(`${source} scenario run failed for ${baseUrl}`);
    process.exitCode = 1;
  } else {
    console.log(`${source} scenario run passed for ${baseUrl}`);
  }
}

async function runLocal() {
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runOne(scenario));
  }
  printResults(results, "Local");
}

function sandboxRunnerSource() {
  return `
const fs = await import("node:fs/promises");
const input = JSON.parse(await fs.readFile("/tmp/vetagent-scenarios.json", "utf8"));
const results = [];
for (const check of input.scenarios) {
  if (check.skip) {
    results.push({ label: check.label, status: "SKIP", ms: 0, bytes: 0, ok: true, error: check.skipReason });
    continue;
  }
  const started = performance.now();
  try {
    const response = await fetch(input.baseUrl + check.path, {
      method: check.method,
      headers: {
        "user-agent": input.userAgent,
        ...(check.body ? { "content-type": "application/json" } : {})
      },
      body: check.body ? JSON.stringify(check.body) : undefined
    });
    const text = await response.text();
    const ms = Math.round(performance.now() - started);
    results.push({
      label: check.label,
      status: response.status,
      ms,
      maxMs: check.maxMs,
      bytes: Buffer.byteLength(text, "utf8"),
      ok: response.ok && ms <= check.maxMs,
      error: response.ok ? "" : text.slice(0, 180)
    });
  } catch (error) {
    results.push({
      label: check.label,
      status: "ERR",
      ms: Math.round(performance.now() - started),
      maxMs: check.maxMs,
      bytes: 0,
      ok: false,
      error: error instanceof Error ? error.message : "request failed"
    });
  }
}
console.log(JSON.stringify(results));
`;
}

async function runE2B() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.log("E2B_API_KEY missing; using local fallback.");
    await runLocal();
    return;
  }
  const { Sandbox } = await import("e2b");
  const sandbox = await Sandbox.create({
    apiKey,
    timeoutMs: 120_000,
    metadata: { app: "vetagent", run: "scenario" }
  });

  try {
    const smoke = await sandbox.commands.run("node -e \"console.log('vetagent-e2b-ready')\"", { timeoutMs: 30_000 });
    if (!smoke.stdout.includes("vetagent-e2b-ready")) {
      throw new Error("E2B sandbox command smoke failed");
    }

    if (isLocalhost(baseUrl)) {
      console.log("E2B sandbox ready. Localhost is not reachable from E2B, so running scenario fallback locally.");
      await runLocal();
      return;
    }

    await sandbox.files.write("/tmp/vetagent-scenarios.json", JSON.stringify({ baseUrl, scenarios, userAgent: scenarioUserAgent }));
    await sandbox.files.write("/tmp/vetagent-scenarios.mjs", sandboxRunnerSource());
    const result = await sandbox.commands.run("node /tmp/vetagent-scenarios.mjs", { timeoutMs: 90_000 });
    const results = JSON.parse(result.stdout.trim());
    printResults(results, "E2B");
  } finally {
    await sandbox.kill().catch(() => {});
  }
}

if (mode === "e2b") {
  await runE2B();
} else {
  await runLocal();
}
