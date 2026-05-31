import {
  createAgentReport,
  createAgentRun,
  createApproval,
  createPricingObservation,
  createTask,
  createWorkflowEvent,
  listAgentReports,
  listApprovals,
  listAvailableSlots,
  listMockClinic,
  listOpenFollowups,
  listPricingObservations,
  listReviewInvoices,
  listServiceCatalog,
  listTasks,
  listWorkflowEvents,
  markAppointmentArrived,
  findArrivalAppointment,
  updateAgentRun,
  type Actor,
  type AgentReport,
  type Approval,
  type MockClient,
  type MockPet,
  type Task,
  type WorkflowEvent
} from "@central-vet/db";

type WorkflowInput = Record<string, unknown>;

type WorkflowResult = {
  ok: true;
  mode: string;
  intent: string;
  message: string;
  result: Record<string, unknown>;
  task?: Task;
  approval?: Approval;
  report?: AgentReport;
  workflowEvents: WorkflowEvent[];
  runId: string;
};

const agentActor: Actor = { name: "VetAgent", role: "admin" };

function stringValue(input: WorkflowInput, key: string) {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function textFromInput(input: WorkflowInput) {
  return [
    stringValue(input, "message"),
    stringValue(input, "request"),
    stringValue(input, "transcript"),
    stringValue(input, "body")
  ].filter(Boolean).join(" ");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dueTimeSoon() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  return date.toTimeString().slice(0, 5);
}

function clientFor(clients: MockClient[], clientId: string) {
  return clients.find((client) => client.id === clientId) ?? null;
}

function petFor(pets: MockPet[], petId: string) {
  return pets.find((pet) => pet.id === petId) ?? null;
}

function classifyIntent(input: WorkflowInput) {
  const text = textFromInput(input).toLowerCase();
  const explicit = stringValue(input, "intent").toLowerCase();
  if (explicit && explicit !== "call") return explicit;
  if (/(arriv|outside|check.?in|waiting|here for)/.test(text)) return "checkin";
  if (/(book|schedule|appointment|reschedule|first available|after 3)/.test(text)) return "booking";
  if (/(pickup|pick up|ready|medication|food|order)/.test(text)) return "pickup";
  if (/(record|transfer|another hospital|send.*hospital)/.test(text)) return "records";
  if (/(sick|breathing|cough|vomit|diarrhea|emergency|hurt|pain|help)/.test(text)) return "sick_pet";
  if (/(follow.?up|vaccine|recheck|refill|due)/.test(text)) return "followup";
  if (/(invoice|bill|charge|payment|refund)/.test(text)) return "invoice";
  if (/(price|pricing|competitor|market|underpriced)/.test(text)) return "pricing";
  if (/(daily|summary|ops|priorit|what should)/.test(text)) return "daily_ops";
  return "unknown";
}

async function finishRun(
  runId: string,
  output: Omit<WorkflowResult, "runId" | "workflowEvents">
) {
  await updateAgentRun(runId, { status: "completed", output });
  const workflowEvents = await listWorkflowEvents({ runId });
  return {
    ...output,
    workflowEvents,
    runId
  };
}

async function startRun(agent: string, intent: string, input: WorkflowInput, mode = "mock") {
  return createAgentRun({ agent, intent, mode, input, status: "running" });
}

async function createWorkflowTask(input: {
  clientName?: string | null;
  clientPhone?: string | null;
  petName?: string | null;
  request: string;
  requestType?: "prescription" | "labs_xrays" | "records_request" | "scheduling" | "patient_update";
  priority?: "low" | "medium" | "high";
  status?: "pending_review" | "due" | "pending";
  notes?: string | null;
}) {
  return createTask(
    {
      hospitalName: process.env.HOSPITAL_NAME || "Central Veterinary Hospital",
      source: "admin",
      status: input.status ?? "pending_review",
      priority: input.priority ?? "medium",
      requestType: input.requestType ?? "patient_update",
      clientName: input.clientName ?? null,
      clientPhone: input.clientPhone ?? null,
      petName: input.petName ?? null,
      request: input.request,
      notes: input.notes ?? null,
      dueDate: today(),
      dueTime: input.priority === "high" ? dueTimeSoon() : "19:00"
    },
    agentActor
  );
}

export async function runCheckin(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "checkin", input);
  const clientName = stringValue(input, "clientName") || stringValue(input, "name") || "Client";
  const clientPhone = stringValue(input, "clientPhone") || stringValue(input, "phone") || null;
  const petName = stringValue(input, "petName") || "Pet";
  const appointment = await findArrivalAppointment({
    clientName,
    clientPhone,
    petName
  });

  if (!appointment) {
    const task = await createWorkflowTask({
      clientName,
      clientPhone,
      petName,
      request: `Arrival check-in needs staff review: ${textFromInput(input) || "Client says they are here."}`,
      requestType: "scheduling",
      priority: "medium",
      status: "pending_review"
    });
    await createWorkflowEvent({
      runId: run.id,
      workflowType: "checkin",
      eventType: "needs_review",
      title: "No matching appointment",
      detail: "A staff task was created for arrival review.",
      metadata: { taskId: task.id }
    });
    return finishRun(run.id, {
      ok: true,
      mode: "mock",
      intent: "checkin",
      message: "I could not find a matching appointment. I notified the front desk so they can check this manually.",
      result: { matched: false },
      task
    });
  }

  if (appointment.status === "arrived") {
    await createWorkflowEvent({
      runId: run.id,
      workflowType: "checkin",
      eventType: "already_arrived",
      title: `${petName} was already checked in`,
      detail: "No duplicate arrival task was created.",
      metadata: { appointmentId: appointment.id }
    });
    return finishRun(run.id, {
      ok: true,
      mode: "mock",
      intent: "checkin",
      message: `${petName} is already checked in. Staff has your arrival on the board.`,
      result: {
        matched: true,
        alreadyArrived: true,
        appointment,
        client: { fullName: clientName, phone: clientPhone },
        pet: { name: petName },
        waitEstimateMinutes: appointment.waitMinutes
      }
    });
  }

  const arrived = await markAppointmentArrived(appointment.id);
  const client = { fullName: clientName, phone: clientPhone };
  const pet = { name: petName };
  const waitConcern = /wait|waiting|long/i.test(textFromInput(input));
  const task = await createWorkflowTask({
    clientName: client.fullName,
    clientPhone: client.phone,
    petName: pet.name,
    request: `${pet.name} arrived for ${appointment.appointmentType}. Current wait estimate: ${appointment.waitMinutes} minutes.`,
    requestType: "scheduling",
    priority: waitConcern || appointment.waitMinutes >= 30 ? "high" : "medium",
    status: "due",
    notes: appointment.notes
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "checkin",
    eventType: "arrived",
    title: `${pet.name} checked in`,
    detail: `${client.fullName} marked arrived for ${appointment.appointmentTime}.`,
    metadata: { appointmentId: appointment.id, taskId: task.id, waitMinutes: appointment.waitMinutes }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "checkin",
    message: `You are checked in for ${pet.name}. Current wait is about ${appointment.waitMinutes} minutes. Staff has been notified.`,
    result: {
      matched: true,
      appointment: arrived ?? appointment,
      client,
      pet,
      waitEstimateMinutes: appointment.waitMinutes
    },
    task
  });
}

export async function runBooking(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "booking", input);
  const appointmentType = stringValue(input, "appointmentType") || stringValue(input, "requestType") || "Vaccines";
  const slots = await listAvailableSlots(appointmentType);
  const task = await createWorkflowTask({
    clientName: stringValue(input, "clientName") || stringValue(input, "name") || null,
    clientPhone: stringValue(input, "clientPhone") || stringValue(input, "phone") || null,
    petName: stringValue(input, "petName") || null,
    request: `Booking request for ${appointmentType}: ${textFromInput(input) || "Client requested appointment options."}`,
    requestType: "scheduling",
    priority: "medium",
    status: "pending_review",
    notes: slots[0] ? `First mock slot: ${slots[0].slotDate} ${slots[0].slotTime} with ${slots[0].doctor}` : "No matching mock slot."
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "booking",
    eventType: "slots_suggested",
    title: "Booking slots suggested",
    detail: `${slots.length} slot(s) returned for ${appointmentType}.`,
    metadata: { taskId: task.id, slotIds: slots.map((slot) => slot.id) }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "booking",
    message: slots[0]
      ? `I found ${slots.length} option(s). The first available is ${slots[0].slotDate} at ${slots[0].slotTime} with ${slots[0].doctor}. Staff will confirm it.`
      : "I did not find a matching mock slot. Staff has been asked to follow up.",
    result: { slots, appointmentType },
    task
  });
}

export async function runPickup(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "pickup", input);
  const clinic = await listMockClinic();
  const petName = stringValue(input, "petName");
  const pet = clinic.pets.find((item) => item.name.toLowerCase().includes(petName.toLowerCase())) ?? null;
  const client = pet ? clientFor(clinic.clients, pet.clientId) : null;
  if (!pet) {
    const task = await createWorkflowTask({
      clientName: stringValue(input, "clientName") || stringValue(input, "name") || null,
      clientPhone: stringValue(input, "clientPhone") || stringValue(input, "phone") || null,
      petName: petName || null,
      request: `Pickup/status request needs staff review: ${textFromInput(input) || "Client asked if pet is ready."}`,
      requestType: "patient_update",
      priority: "medium",
      status: "pending_review"
    });
    await createWorkflowEvent({
      runId: run.id,
      workflowType: "pickup",
      eventType: "needs_review",
      title: "Pickup pet not matched",
      metadata: { taskId: task.id, submittedPetName: petName || null }
    });
    return finishRun(run.id, {
      ok: true,
      mode: "mock",
      intent: "pickup",
      message: "I could not match that pet to a pickup record. I notified staff so they can check manually.",
      result: { ready: false, matched: false },
      task
    });
  }
  const ready = pet?.id === "pet-luna";
  const task = await createWorkflowTask({
    clientName: client?.fullName,
    clientPhone: client?.phone,
    petName: pet?.name,
    request: `Pickup/status request: ${textFromInput(input) || "Client asked if pet is ready."}`,
    requestType: "patient_update",
    priority: ready ? "low" : "medium",
    status: ready ? "due" : "pending_review"
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "pickup",
    eventType: ready ? "ready" : "status_requested",
    title: ready ? "Pet ready for pickup" : "Pickup status requested",
    metadata: { taskId: task.id, petId: pet?.id ?? null }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "pickup",
    message: ready
      ? `${pet?.name || "Your pet"} is marked ready for pickup. Please check in at the front desk.`
      : `I asked the team for a pickup status update for ${pet?.name || "your pet"}.`,
    result: { ready, pet, client },
    task
  });
}

export async function runFollowup(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "followup", input);
  const clinic = await listMockClinic();
  const followups = await listOpenFollowups();
  const followup = followups[0] ?? null;
  const client = followup ? clientFor(clinic.clients, followup.clientId) : null;
  const pet = followup ? petFor(clinic.pets, followup.petId) : null;
  const task = await createWorkflowTask({
    clientName: client?.fullName,
    clientPhone: client?.phone,
    petName: pet?.name,
    request: followup
      ? `Follow-up opportunity: ${pet?.name} is due for ${followup.followupType}. ${followup.recommendedAction}`
      : `Follow-up response received: ${textFromInput(input) || "Client responded to follow-up."}`,
    requestType: "scheduling",
    priority: "medium",
    status: "pending_review"
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "followup",
    eventType: "task_created",
    title: "Follow-up task created",
    metadata: { taskId: task.id, followupId: followup?.id ?? null }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "followup",
    message: followup
      ? `I found a follow-up opportunity for ${pet?.name}. Staff has a task to turn it into an appointment.`
      : "Staff has a task to review this follow-up response.",
    result: { followup, client, pet },
    task
  });
}

export async function runRecords(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "records", input);
  const task = await createWorkflowTask({
    clientName: stringValue(input, "clientName") || stringValue(input, "name") || null,
    clientPhone: stringValue(input, "clientPhone") || stringValue(input, "phone") || null,
    petName: stringValue(input, "petName") || null,
    request: `Records transfer request: ${textFromInput(input) || "Client requested records transfer."}`,
    requestType: "records_request",
    priority: "medium",
    status: "pending_review",
    notes: "Approval required before records are sent."
  });
  const approval = await createApproval({
    runId: run.id,
    taskId: task.id,
    approvalType: "records_transfer",
    title: "Approve records transfer",
    summary: "Client requested pet records be sent to another hospital. Staff review is required before sending.",
    requestedAction: {
      clientName: stringValue(input, "clientName") || stringValue(input, "name") || null,
      petName: stringValue(input, "petName") || null,
      destination: stringValue(input, "destination") || "Destination hospital not provided"
    }
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "records",
    eventType: "approval_created",
    title: "Records approval created",
    detail: "No records were sent automatically.",
    metadata: { taskId: task.id, approvalId: approval.id }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "records",
    message: "I created a records-transfer approval for staff. Records will not be sent until a person reviews it.",
    result: { requiresApproval: true },
    task,
    approval
  });
}

export async function runSickPet(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("external", "sick_pet", input);
  const task = await createWorkflowTask({
    clientName: stringValue(input, "clientName") || stringValue(input, "name") || null,
    clientPhone: stringValue(input, "clientPhone") || stringValue(input, "phone") || null,
    petName: stringValue(input, "petName") || null,
    request: `Urgent sick-pet message. Staff triage needed. Client said: ${textFromInput(input) || "Pet is sick and needs help."}`,
    requestType: "patient_update",
    priority: "high",
    status: "due",
    notes: "Agent did not provide diagnosis or treatment advice."
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "sick_pet",
    eventType: "urgent_task_created",
    title: "Urgent sick-pet task created",
    detail: "No diagnosis or medical recommendation was provided.",
    metadata: { taskId: task.id }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "sick_pet",
    message: "I flagged this for urgent staff triage. If this is an emergency, call the hospital or go to the nearest emergency clinic now.",
    result: { escalated: true, medicalAdviceGiven: false },
    task
  });
}

export async function runCall(input: WorkflowInput): Promise<WorkflowResult> {
  const intent = classifyIntent(input);
  if (intent === "checkin") return runCheckin({ ...input, intent: "checkin" });
  if (intent === "booking") return runBooking({ ...input, intent: "booking" });
  if (intent === "records") return runRecords({ ...input, intent: "records" });
  if (intent === "pickup") return runPickup({ ...input, intent: "pickup" });
  if (intent === "sick_pet") return runSickPet({ ...input, intent: "sick_pet" });
  if (intent === "followup") return runFollowup({ ...input, intent: "followup" });

  const run = await startRun("external", "call", input);
  const task = await createWorkflowTask({
    clientName: stringValue(input, "callerName") || stringValue(input, "clientName") || null,
    clientPhone: stringValue(input, "callerPhone") || stringValue(input, "clientPhone") || null,
    petName: stringValue(input, "petName") || null,
    request: `Call transcript needs review: ${textFromInput(input) || "No transcript provided."}`,
    requestType: "patient_update",
    priority: "medium",
    status: "pending_review"
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "call",
    eventType: "task_created",
    title: "Call routed to staff",
    metadata: { taskId: task.id, classifiedIntent: intent }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "call",
    message: "I turned this call into a staff review task.",
    result: { classifiedIntent: intent },
    task
  });
}

export async function runInvoice(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("internal", "invoice", input);
  const invoices = await listReviewInvoices();
  const task = await createWorkflowTask({
    request: invoices[0]
      ? `Invoice review: ${invoices[0].invoiceNumber} has ${invoices[0].flags.length} flag(s).`
      : "Invoice review requested. No flagged mock invoices found.",
    requestType: "patient_update",
    priority: invoices.length ? "medium" : "low",
    status: "pending_review",
    notes: "Agent did not change invoices."
  });
  const report = await createAgentReport({
    runId: run.id,
    taskId: task.id,
    reportType: "invoice",
    title: "Invoice review",
    summary: invoices.length
      ? `${invoices.length} invoice(s) need staff review.`
      : "No mock invoice issues found.",
    data: { invoices, changedInvoices: false }
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "invoice",
    eventType: "report_created",
    title: "Invoice review report created",
    metadata: { taskId: task.id, reportId: report.id }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "invoice",
    message: report.summary,
    result: { invoices, changedInvoices: false },
    task,
    report
  });
}

async function fetchApifyPricing(input: WorkflowInput) {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_PRICING_ACTOR_ID;
  if (!token || !actorId || input.live !== true) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?timeout=30`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input.apifyInput ?? {}),
        signal: controller.signal
      }
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return Array.isArray(data) ? data.slice(0, 10) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPricing(input: WorkflowInput): Promise<WorkflowResult> {
  const liveItems = await fetchApifyPricing(input);
  const mode = liveItems ? "apify" : "mock";
  const run = await startRun("internal", "pricing", input, mode);
  if (liveItems) {
    for (const item of liveItems) {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      await createPricingObservation({
        source: "apify",
        competitorName: String(row.competitorName || row.name || row.title || "Unknown competitor"),
        serviceName: String(row.serviceName || row.service || "Unknown service"),
        observedPriceCents: typeof row.priceCents === "number" ? row.priceCents : null,
        observedText: typeof row.price === "string" ? row.price : null,
        url: typeof row.url === "string" ? row.url : null,
        raw: row
      });
    }
  }

  const [services, observations] = await Promise.all([
    listServiceCatalog(),
    listPricingObservations(50)
  ]);
  const comparisons = observations.slice(0, 12).map((observation) => {
    const service = services.find((item) =>
      item.serviceName.toLowerCase().includes(observation.serviceName.toLowerCase()) ||
      observation.serviceName.toLowerCase().includes(item.serviceName.toLowerCase())
    );
    const deltaCents =
      service && typeof observation.observedPriceCents === "number"
        ? observation.observedPriceCents - service.currentPriceCents
        : null;
    return {
      observation,
      service,
      deltaCents,
      recommendation:
        deltaCents === null
          ? "Review manually"
          : deltaCents > 1000
            ? "Clinic may be under local market; review price."
            : deltaCents < -1000
              ? "Clinic may be above local market; review positioning."
              : "Close to observed market."
    };
  });
  const flagged = comparisons.filter((item) => item.deltaCents === null || Math.abs(item.deltaCents) > 1000);
  const task = await createWorkflowTask({
    request: `Pricing review: ${flagged.length} service(s) need staff review. No prices changed.`,
    requestType: "patient_update",
    priority: flagged.length ? "medium" : "low",
    status: "pending_review",
    notes: flagged.map((item) => `${item.service?.serviceName || item.observation.serviceName}: ${item.recommendation}`).join("\n")
  });
  const report = await createAgentReport({
    runId: run.id,
    taskId: task.id,
    reportType: "pricing",
    title: "Competitor pricing review",
    summary: `${flagged.length} pricing item(s) flagged. No automatic repricing occurred.`,
    data: { mode, services, comparisons, changedPrices: false }
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "pricing",
    eventType: "report_created",
    title: "Pricing report created",
    detail: `${mode === "apify" ? "Apify live data" : "Sample fallback data"} used.`,
    metadata: { taskId: task.id, reportId: report.id, flaggedCount: flagged.length }
  });
  return finishRun(run.id, {
    ok: true,
    mode,
    intent: "pricing",
    message: `${flagged.length} pricing item(s) need review. I created a report and task; no prices were changed.`,
    result: { comparisons, flagged, changedPrices: false },
    task,
    report
  });
}

export async function runDailyOps(input: WorkflowInput): Promise<WorkflowResult> {
  const run = await startRun("internal", "daily_ops", input);
  const [tasks, approvals, followups, invoices, pricingReports] = await Promise.all([
    listTasks({ role: "admin", includeArchived: false }),
    listApprovals({ status: "pending", limit: 20 }),
    listOpenFollowups(),
    listReviewInvoices(),
    listAgentReports({ reportType: "pricing", limit: 5 })
  ]);
  const highPriority = tasks.filter((task) => task.priority === "high" && task.status !== "completed");
  const summary = {
    openTasks: tasks.filter((task) => task.status !== "completed" && task.status !== "archived").length,
    highPriority: highPriority.length,
    pendingApprovals: approvals.length,
    openFollowups: followups.length,
    invoiceReviews: invoices.length,
    recentPricingReports: pricingReports.length
  };
  const report = await createAgentReport({
    runId: run.id,
    reportType: "daily_ops",
    title: "Daily ops digest",
    summary: `${summary.openTasks} open task(s), ${summary.highPriority} high-priority, ${summary.pendingApprovals} approval(s) pending.`,
    data: { summary, highPriority, approvals, followups, invoices, pricingReports }
  });
  await createWorkflowEvent({
    runId: run.id,
    workflowType: "daily_ops",
    eventType: "digest_created",
    title: "Daily ops digest created",
    metadata: { reportId: report.id, summary }
  });
  return finishRun(run.id, {
    ok: true,
    mode: "mock",
    intent: "daily_ops",
    message: report.summary,
    result: { summary, highPriority, approvals, followups, invoices, pricingReports },
    report
  });
}

export async function runExternalAgent(input: WorkflowInput): Promise<WorkflowResult> {
  const intent = classifyIntent(input);
  if (intent === "checkin") return runCheckin(input);
  if (intent === "booking") return runBooking(input);
  if (intent === "pickup") return runPickup(input);
  if (intent === "records") return runRecords(input);
  if (intent === "sick_pet") return runSickPet(input);
  if (intent === "followup") return runFollowup(input);
  return runCall(input);
}

export async function runInternalAgent(input: WorkflowInput): Promise<WorkflowResult> {
  const intent = classifyIntent(input);
  if (intent === "pricing") return runPricing(input);
  if (intent === "records") return runRecords(input);
  if (intent === "invoice") return runInvoice(input);
  if (intent === "followup") return runFollowup(input);
  if (intent === "sick_pet") return runSickPet(input);
  return runDailyOps(input);
}
