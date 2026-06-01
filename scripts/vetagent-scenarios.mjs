#!/usr/bin/env node

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const jsonl = args.has("--jsonl");
const mode = args.has("--e2b") || process.env.SCENARIO_MODE === "e2b" ? "e2b" : "local";
const baseUrl = process.env.SCENARIO_BASE_URL || process.env.LOCAL_BASE_URL || "http://localhost:3000";
const runSalt = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const scenarioUserAgent = `vetagent-scenarios/${runSalt}`;
const managerPasscode = process.env.VET_APP_ADMIN_PASSCODE || process.env.VET_ADMIN_PASSCODE || "";

function managerActor() {
  return {
    name: "Scenario Runner",
    role: "admin",
    passcode: managerPasscode
  };
}

function publicBody(body) {
  return {
    clientName: body.clientName,
    clientPhone: body.clientPhone,
    petName: body.petName,
    message: body.message || body.request || body.transcript || `Scenario ${runSalt}.`,
    ...body
  };
}

const scenarios = [
  {
    label: "call transcript to check-in",
    path: "/api/agent/call",
    body: publicBody({
      callerName: "Luis Rivera",
      callerPhone: "(415) 555-0199",
      clientName: "Luis Rivera",
      clientPhone: "(415) 555-0199",
      petName: "Luna",
      transcript: `Hi, this is Luis. I am outside for Luna's appointment and want to check in. Scenario ${runSalt}.`
    }),
    expect: { intent: "checkin", minTools: 3, tools: ["triage_call", "mark_arrived", "get_wait_status"], result: { action: "checked_in" } }
  },
  {
    label: "arrival happy path",
    path: "/api/agent/checkin",
    body: publicBody({
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I am outside for my appointment. Scenario ${runSalt}.`
    }),
    expect: { intent: "checkin", minTools: 3, tools: ["start_arrival", "mark_arrived", "get_wait_status"], result: { matched: true, action: "checked_in" } }
  },
  {
    label: "arrival already arrived",
    path: "/api/agent/checkin",
    body: publicBody({
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I am still outside checking that Biscuit is already checked in. Scenario ${runSalt}.`
    }),
    expect: { intent: "checkin", minTools: 3, tools: ["start_arrival", "mark_arrived", "get_wait_status"], result: { matched: true, alreadyArrived: true }, noTaskRequired: true }
  },
  {
    label: "arrival no appointment",
    path: "/api/agent/checkin",
    body: publicBody({
      clientName: "Tessa Novel",
      clientPhone: "(415) 555-0191",
      petName: "Moose",
      message: `I am here but I am not sure my appointment exists. Scenario ${runSalt}.`
    }),
    expect: { intent: "checkin", task: true, minTools: 2, tools: ["start_arrival", "create_task"], result: { matched: false } }
  },
  {
    label: "wait complaint",
    path: "/api/agent/checkin",
    body: publicBody({
      clientName: "Avery Johnson",
      clientPhone: "(415) 555-0108",
      petName: "Otis",
      message: `I am outside and have been waiting a long time for Otis. Scenario ${runSalt}.`
    }),
    expect: { intent: "checkin", task: true, minTools: 3, tools: ["start_arrival", "mark_arrived", "get_wait_status"], taskPriority: "high" }
  },
  {
    label: "booking happy path",
    path: "/api/agent/booking",
    body: publicBody({
      clientName: "Luis Rivera",
      clientPhone: "(415) 555-0199",
      petName: "Luna",
      appointmentType: "Vaccines",
      message: `Can I book vaccines next week after 3 if anything is open? Scenario ${runSalt}.`
    }),
    expect: { intent: "booking", minTools: 3, tools: ["start_arrival", "list_slots", "book_appointment"], result: { booked: true, action: "appointment_booked" }, resultPresent: ["appointment.id", "confirmationId"] }
  },
  {
    label: "booking ambiguous",
    path: "/api/agent/booking",
    body: publicBody({
      clientName: "Unknown Booker",
      clientPhone: "(415) 555-0188",
      petName: "Pebble",
      appointmentType: "Dental",
      message: `Can I schedule a dental appointment? Scenario ${runSalt}.`
    }),
    expect: { intent: "booking", task: true, minTools: 2, tools: ["start_arrival", "create_task"], result: { booked: false } }
  },
  {
    label: "pickup status ready",
    path: "/api/agent/pickup",
    body: publicBody({
      clientName: "Luis Rivera",
      clientPhone: "(415) 555-0199",
      petName: "Luna",
      message: `Is Luna ready for pickup yet? Scenario ${runSalt}.`
    }),
    expect: { intent: "pickup", minTools: 3, tools: ["start_arrival", "get_wait_status", "send_status_update"], result: { ready: true, action: "pickup_ready_confirmed", source: "mock/DB data" } }
  },
  {
    label: "pickup status unknown",
    path: "/api/agent/pickup",
    body: publicBody({
      clientName: "Nora Unknown",
      clientPhone: "(415) 555-0149",
      petName: "Comet",
      message: `Is Comet ready for pickup? Scenario ${runSalt}.`
    }),
    expect: { intent: "pickup", task: true, minTools: 2, tools: ["start_arrival", "create_task"], result: { source: "mock/DB data" } }
  },
  {
    label: "records transfer approval",
    path: "/api/agent/records",
    body: publicBody({
      clientName: "Hannah Kim",
      clientPhone: "(415) 555-0172",
      petName: "Maple",
      destination: "Bayview Animal Clinic",
      message: `Please send Maple's vaccine records to Bayview Animal Clinic. Scenario ${runSalt}.`
    }),
    expect: {
      intent: "records",
      minTools: 3,
      tools: ["prepare_records_packet", "audit_records_transfer", "complete_records_transfer"],
      result: { requiresApproval: false, recordsSentAutomatically: true, "audit.audit.source": "local_records_policy", "transfer.transfer.status": "queued" }
    }
  },
  {
    label: "internal records review",
    path: "/api/agent/internal",
    body: {
      actor: managerActor(),
      clientName: "Hannah Kim",
      clientPhone: "(415) 555-0172",
      petName: "Maple",
      destination: "Bayview Animal Clinic",
      request: `Prepare Maple's records transfer packet for internal review. Scenario ${runSalt}.`
    },
    expect: {
      intent: "records",
      minTools: 3,
      tools: ["prepare_records_packet", "audit_records_transfer", "complete_records_transfer"],
      messageIncludes: "secure transfer",
      messageExcludes: "approval",
      result: { audience: "internal", requiresApproval: false, recordsSentAutomatically: true, "audit.audit.source": "local_records_policy" }
    }
  },
  {
    label: "sick-pet emergency",
    path: "/api/agent/external",
    body: publicBody({
      clientName: "Avery Johnson",
      clientPhone: "(415) 555-0108",
      petName: "Otis",
      message: `Otis is coughing blood and breathing harder than usual. Scenario ${runSalt}.`
    }),
    expect: { intent: "sick_pet", task: true, minTools: 1, tools: ["create_task"], safety: { medicalAdviceGiven: false }, taskPriority: "high" }
  },
  {
    label: "sick-pet non-emergency",
    path: "/api/agent/external",
    body: publicBody({
      clientName: "Hannah Kim",
      clientPhone: "(415) 555-0172",
      petName: "Maple",
      message: `Maple vomited once but is alert. Please have someone call me. Scenario ${runSalt}.`
    }),
    expect: { intent: "sick_pet", task: true, minTools: 1, tools: ["create_task"], safety: { medicalAdviceGiven: false } }
  },
  {
    label: "call transcript unknown",
    path: "/api/agent/call",
    body: publicBody({
      callerName: "Taylor Client",
      callerPhone: "(415) 555-0111",
      clientName: "Taylor Client",
      clientPhone: "(415) 555-0111",
      petName: "Nova",
      transcript: `I have a complicated question and need someone at the clinic to call me. Scenario ${runSalt}.`
    }),
    expect: { intent: "call", task: true, minTools: 2, tools: ["triage_call", "create_task"] }
  },
  {
    label: "follow-up scan",
    path: "/api/agent/followup",
    body: publicBody({
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: `I got a vaccine reminder and want to know what is due. Scenario ${runSalt}.`
    }),
    expect: { intent: "followup", report: true, minTools: 2, tools: ["find_followup_candidates", "create_followup_task"], result: { action: "followup_outreach_queued", "outreach.status": "queued" }, resultPresent: ["candidate.id"] }
  },
  {
    label: "daily ops",
    path: "/api/agent/daily-ops",
    body: { actor: managerActor(), request: `What needs attention today? Scenario ${runSalt}.` },
    expect: {
      intent: "daily_ops",
      report: true,
      minTools: 4,
      tools: ["list_tasks", "list_approvals", "list_followup_candidates", "list_reports", "create_daily_ops_report"],
      resultPresent: ["summary.openTasks", "rankedWork.0"]
    }
  },
  {
    label: "invoice review",
    path: "/api/agent/invoice",
    body: { actor: managerActor(), request: `Review invoice flags. Scenario ${runSalt}.` },
    expect: { intent: "invoice", task: true, report: true, minTools: 1, tools: ["flag_invoice_issue"], safety: { changedInvoices: false } }
  },
  {
    label: "pricing sample",
    path: "/api/agent/pricing",
    body: { actor: managerActor(), live: false, request: `Run pricing review. Scenario ${runSalt}.` },
    expect: {
      intent: "pricing",
      task: true,
      report: true,
      minTools: 3,
      tools: ["list_service_catalog", "run_competitor_scan", "compare_service_prices", "create_price_review_report"],
      safety: { changedPrices: false }
    }
  },
  {
    label: "pricing live fallback",
    path: "/api/agent/pricing",
    body: { actor: managerActor(), live: true, request: `Run live pricing review if configured. Scenario ${runSalt}.` },
    expect: {
      intent: "pricing",
      task: true,
      report: true,
      minTools: 3,
      tools: ["list_service_catalog", "run_competitor_scan", "compare_service_prices", "create_price_review_report"],
      safety: { changedPrices: false }
    }
  },
  {
    label: "internal lab-result review",
    path: "/api/agent/internal",
    body: { actor: managerActor(), request: `Check final abnormal mock lab results and create review tasks. Scenario ${runSalt}.` },
    expect: {
      intent: "labs",
      task: true,
      minTools: 4,
      tools: ["list_lab_catalog", "lookup_lab_orders", "get_lab_result", "summarize_lab_result", "create_lab_followup_task"],
      safety: { medicalAdviceGiven: false },
      result: { labVendor: "antech_mock", source: "mock lab data" }
    }
  }
];

function size(value) {
  return value ? Buffer.byteLength(value, "utf8") : 0;
}

function isLocalhost(url) {
  return /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
}

function getPath(value, path) {
  return path.split(".").reduce((item, key) => item?.[key], value);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function detailSummary(detail) {
  if (!detail || detail.error) {
    return {
      ok: false,
      status: detail?.status ?? null,
      error: detail?.error ?? null,
      runStatus: null,
      runMode: null,
      model: null,
      workflowEventCount: 0,
      toolCallCount: 0,
      workflowEventTypes: [],
      toolNames: [],
      linkedTaskIds: [],
      linkedApprovalIds: [],
      linkedReportIds: []
    };
  }
  return {
    ok: Boolean(detail.run?.id),
    status: 200,
    runStatus: detail.run?.status ?? null,
    runMode: detail.run?.mode ?? null,
    model: detail.run?.model ?? null,
    workflowEventCount: detail.workflowEvents?.length ?? 0,
    toolCallCount: detail.toolCalls?.length ?? 0,
    workflowEventTypes: unique((detail.workflowEvents ?? []).map((event) => event.eventType)),
    toolNames: unique((detail.toolCalls ?? []).map((tool) => tool.toolName)),
    linkedTaskIds: detail.linkedTaskIds ?? [],
    linkedApprovalIds: detail.linkedApprovalIds ?? [],
    linkedReportIds: detail.linkedReportIds ?? []
  };
}

function assertScenario(scenario, data, detail) {
  const errors = [];
  const expect = scenario.expect;
  const responseToolNames = unique((data.toolCalls ?? []).map((tool) => tool.toolName));
  const responseEventTypes = unique((data.workflowEvents ?? []).map((event) => event.eventType));
  if (data.ok !== true) errors.push("ok not true");
  if (expect.intent && data.intent !== expect.intent) errors.push(`intent ${data.intent || "missing"} expected ${expect.intent}`);
  if (!data.runId) errors.push("runId missing");
  if (!data.traceId) errors.push("traceId missing");
  if (expect.task && !data.task?.id) errors.push("task missing");
  if (expect.approval && !data.approval?.id) errors.push("approval missing");
  if (expect.report && !data.report?.id) errors.push("report missing");
  if (expect.taskPriority && data.task?.priority !== expect.taskPriority) errors.push(`task priority ${data.task?.priority || "missing"} expected ${expect.taskPriority}`);
  if (expect.messageIncludes && !data.message?.includes(expect.messageIncludes)) errors.push(`message missing ${expect.messageIncludes}`);
  if (expect.messageExcludes && data.message?.includes(expect.messageExcludes)) errors.push(`message included ${expect.messageExcludes}`);
  if ((data.workflowEvents?.length ?? 0) < 1) errors.push("workflowEvents missing");
  if ((data.toolCalls?.length ?? 0) < (expect.minTools ?? 1)) errors.push(`toolCalls ${(data.toolCalls?.length ?? 0)} below ${expect.minTools ?? 1}`);
  for (const toolName of expect.tools ?? []) {
    if (!responseToolNames.includes(toolName)) errors.push(`tool ${toolName} missing`);
  }
  for (const eventType of expect.workflowEvents ?? []) {
    if (!responseEventTypes.includes(eventType)) errors.push(`workflow event ${eventType} missing`);
  }
  if (detail) {
    if (!detail.run?.id) errors.push("run detail missing persisted run");
    if ((detail.workflowEvents?.length ?? 0) < 1) errors.push("run detail workflow events missing");
    if ((detail.toolCalls?.length ?? 0) < (expect.minTools ?? 1)) errors.push("run detail tool calls missing");
    const detailToolNames = unique((detail.toolCalls ?? []).map((tool) => tool.toolName));
    for (const toolName of expect.tools ?? []) {
      if (!detailToolNames.includes(toolName)) errors.push(`run detail tool ${toolName} missing`);
    }
    if (expect.task && !detail.linkedTaskIds?.length) errors.push("run detail linked task missing");
    if (expect.approval && !detail.linkedApprovalIds?.length) errors.push("run detail linked approval missing");
    if (expect.report && !detail.linkedReportIds?.length) errors.push("run detail linked report missing");
  }
  for (const [key, value] of Object.entries(expect.result ?? {})) {
    if (getPath(data.result, key) !== value) errors.push(`result.${key} expected ${String(value)}`);
  }
  for (const [key, value] of Object.entries(expect.resultNot ?? {})) {
    if (getPath(data.result, key) === value) errors.push(`result.${key} must not be ${String(value)}`);
  }
  for (const key of expect.resultPresent ?? []) {
    if (getPath(data.result, key) === undefined || getPath(data.result, key) === null) errors.push(`result.${key} missing`);
  }
  for (const [key, value] of Object.entries(expect.safety ?? {})) {
    if (getPath(data.result, key) !== value) errors.push(`safety ${key} expected ${String(value)}`);
  }
  return errors;
}

async function fetchRunDetail(runId, fetchImpl) {
  if (!runId || !managerPasscode) return null;
  const url = `${baseUrl}/api/agent/runs/${runId}?role=admin&name=Scenario%20Runner&passcode=${encodeURIComponent(managerPasscode)}`;
  const response = await fetchImpl(url, { headers: { "user-agent": scenarioUserAgent } });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return response.ok ? data : { error: data.error || text, status: response.status };
}

async function runOne(scenario, provider, fetchImpl = fetch) {
  const started = performance.now();
  const method = scenario.method ?? "POST";
  const response = await fetchImpl(`${baseUrl}${scenario.path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": scenarioUserAgent
    },
    body: JSON.stringify(scenario.body)
  });
  const text = await response.text();
  const ms = Math.round(performance.now() - started);
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { parseError: text.slice(0, 180) };
  }
  const detail = response.ok ? await fetchRunDetail(data.runId, fetchImpl).catch((error) => ({ error: error.message })) : null;
  const errors = response.ok ? assertScenario(scenario, data, detail) : [data.error || text.slice(0, 180) || `HTTP ${response.status}`];
  const runDetail = detailSummary(detail);
  const safety = {
    medicalAdviceGiven: data.result?.medicalAdviceGiven,
    requiresApproval: data.result?.requiresApproval,
    changedInvoices: data.result?.changedInvoices,
    changedPrices: data.result?.changedPrices
  };
  const proof = {
    recordsAuditSource: data.result?.audit?.audit?.source ?? null,
    recordsSentAutomatically: data.result?.recordsSentAutomatically ?? null,
    pickupSource: data.result?.source ?? null,
    candidateId: data.result?.candidate?.id ?? null,
    labVendor: data.result?.labVendor ?? null,
    labSource: data.result?.source === "mock lab data" ? data.result.source : null,
    rankedWorkFirst: data.result?.rankedWork?.[0] ?? null
  };
  return {
    label: scenario.label,
    method,
    path: scenario.path,
    ok: response.ok && errors.length === 0,
    provider,
    status: response.status,
    ms,
    bytes: size(text),
    runId: data.runId ?? null,
    traceId: data.traceId ?? null,
    intent: data.intent ?? null,
    mode: data.mode ?? null,
    taskId: data.task?.id ?? null,
    approvalId: data.approval?.id ?? null,
    reportId: data.report?.id ?? null,
    toolCallCount: data.toolCalls?.length ?? 0,
    workflowEventCount: data.workflowEvents?.length ?? 0,
    toolNames: unique((data.toolCalls ?? []).map((tool) => tool.toolName)),
    workflowEventTypes: unique((data.workflowEvents ?? []).map((event) => event.eventType)),
    runDetail,
    proof,
    safety,
    errors
  };
}

function emit(results, provider) {
  let failed = 0;
  for (const result of results) {
    if (!result.ok) failed += 1;
    if (jsonl) {
      console.log(JSON.stringify(result));
      continue;
    }
    const state = result.ok ? "PASS" : "FAIL";
    const detail = result.errors.length ? ` ${result.errors.join("; ")}` : "";
    console.log(`${state} ${result.label}: ${result.method} ${result.path} ${result.status} ${result.ms}ms ${result.bytes}b runId=${result.runId || "none"} traceId=${result.traceId || "none"} tools=${result.toolCallCount}${detail}`);
  }
  const summary = {
    type: "summary",
    ok: failed === 0,
    passed: results.length - failed,
    failed,
    provider,
    baseUrl
  };
  if (jsonl) console.log(JSON.stringify(summary));
  else if (failed) {
    console.error(`FAIL ${failed} scenario check(s) failed for ${baseUrl}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS all agent checks for ${baseUrl}`);
  }
  if (jsonl && failed) process.exitCode = 1;
}

async function resetClinic(fetchImpl = fetch) {
  if (!managerPasscode) return;
  const url = `${baseUrl}/api/mock/clinic?role=admin&name=Scenario%20Runner&passcode=${encodeURIComponent(managerPasscode)}`;
  try {
    const response = await fetchImpl(url, { method: "POST", headers: { "user-agent": scenarioUserAgent } });
    if (!jsonl) {
      const data = await response.json().catch(() => ({}));
      console.log(`RESET mock clinic fixtures: ${response.status} reset=${data?.reset?.resetAppointments ?? "?"} (idempotent re-run support)`);
    }
  } catch {
    // best-effort reset; scenarios still run if the reset route is unavailable
  }
}

async function runLocal(provider = "local") {
  if (!managerPasscode) {
    const result = {
      label: "manager passcode",
      ok: false,
      provider,
      status: "ENV",
      ms: 0,
      runId: null,
      traceId: null,
      intent: null,
      taskId: null,
      approvalId: null,
      reportId: null,
      safety: {},
      errors: ["VET_APP_ADMIN_PASSCODE or VET_ADMIN_PASSCODE missing"]
    };
    emit([result], provider);
    return;
  }
  await resetClinic();
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runOne(scenario, provider));
  }
  emit(results, provider);
}

async function runE2B() {
  if (!process.env.E2B_API_KEY || isLocalhost(baseUrl)) {
    if (!jsonl) console.log("E2B unavailable for localhost or missing token; using local provider fallback.");
    await runLocal("local");
    return;
  }
  const { Sandbox } = await import("e2b");
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 120_000,
    metadata: { app: "vetagent", run: "scenario" }
  });
  try {
    await sandbox.commands.run("node -e \"console.log('vetagent-e2b-ready')\"", { timeoutMs: 30_000 });
    if (!jsonl) console.log("E2B sandbox ready; running HTTP scenarios from local process against deployed URL.");
    await runLocal("e2b");
  } finally {
    await sandbox.kill().catch(() => {});
  }
}

if (mode === "e2b") await runE2B();
else await runLocal("local");
