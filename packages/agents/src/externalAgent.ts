import type {
  AgentInput,
  AgentTaskDraft,
  AgentWorkflowResult,
  MockAppointment,
  MockClient,
  MockPet,
  RunAgentOptions
} from "./contracts";
import { checkMedicalGuardrail } from "./guardrails";
import {
  buildResult,
  classifyIntent,
  createRuntime,
  normalizeAgentInput,
  resolveMode
} from "./mockProvider";
import { runCallAgent } from "./callAgent";
import { runFollowupAgent } from "./followupAgent";
import { runRecordsAgent } from "./recordsAgent";
import { executeTool, getInputText } from "./tools";

type ArrivalResult = {
  client: MockClient | null;
  pet: MockPet | null;
  appointment: MockAppointment | null;
};

type WaitResult = {
  waitStatus: {
    waitMinutes: number;
    queuePosition: number;
    roomStatus: string;
  } | null;
};

type BookingToolResult = {
  booked: boolean;
  slot?: { slotDate: string; slotTime: string; doctor: string; appointmentType: string } | null;
  client?: MockClient | null;
  pet?: MockPet | null;
  task?: AgentTaskDraft | null;
};

type TaskToolResult = {
  task: AgentTaskDraft;
};

export async function runExternalAgent(input: AgentInput | unknown, options: RunAgentOptions = {}): Promise<AgentWorkflowResult> {
  const normalized = normalizeAgentInput(input);
  const intent = classifyIntent(normalized, "call");
  if (intent === "records") return runRecordsAgent(normalized, options);
  if (intent === "followup") return runFollowupAgent(normalized, options);
  if (intent === "call" || intent === "unknown") return runCallAgent(normalized, options);

  const mode = resolveMode(options);
  const runtime = createRuntime(normalized, intent, options);

  if (intent === "sick_pet") {
    const guardrail = checkMedicalGuardrail(normalized);
    const taskResult = await executeTool("create_task", {
      status: "due",
      priority: guardrail.priority,
      requestType: "patient_update",
      clientName: normalized.clientName ?? normalized.callerName ?? null,
      clientPhone: normalized.clientPhone ?? normalized.callerPhone ?? null,
      petName: normalized.petName ?? null,
      request: `Urgent sick-pet triage needed: ${getInputText(normalized) || "Client reports pet illness."}`,
      notes: `Guardrail matched: ${guardrail.reasons.join(", ") || "medical concern"}`
    }, runtime) as TaskToolResult;
    return buildResult({
      intent,
      mode,
      message: guardrail.message ?? "I alerted the clinical team for urgent review.",
      result: { escalated: true, medicalAdviceGiven: false, reasons: guardrail.reasons },
      runtime,
      options,
      task: taskResult.task
    });
  }

  if (intent === "checkin") {
    const arrival = await executeTool("start_arrival", {
      clientName: normalized.clientName ?? normalized.callerName,
      clientPhone: normalized.clientPhone ?? normalized.callerPhone,
      petName: normalized.petName
    }, runtime) as ArrivalResult;

    if (!arrival.appointment || !arrival.client || !arrival.pet) {
      const taskResult = await executeTool("create_task", {
        status: "pending_review",
        priority: /wait|waiting/i.test(getInputText(normalized)) ? "high" : "medium",
        requestType: "scheduling",
        clientName: normalized.clientName ?? normalized.callerName ?? null,
        clientPhone: normalized.clientPhone ?? normalized.callerPhone ?? null,
        petName: normalized.petName ?? null,
        request: `Arrival check-in needs staff review: ${getInputText(normalized) || "Client says they are here."}`,
        notes: "No matching appointment found in mock data."
      }, runtime) as TaskToolResult;
      return buildResult({
        intent,
        mode,
        message: "I could not find a matching appointment. I notified the front desk so they can check this manually.",
        result: { matched: false },
        runtime,
        options,
        task: taskResult.task
      });
    }

    const arrived = await executeTool("mark_arrived", { appointmentId: arrival.appointment.id }, runtime) as {
      task: AgentTaskDraft;
    };
    const wait = await executeTool("get_wait_status", { appointmentId: arrival.appointment.id }, runtime) as WaitResult;
    const waitMinutes = wait.waitStatus?.waitMinutes ?? arrival.appointment.waitMinutes;
    const message = `You are checked in for ${arrival.pet.name}. Current wait is about ${waitMinutes} minutes. Staff has been notified.`;
    return buildResult({
      intent,
      mode,
      message,
      result: {
        matched: true,
        client: arrival.client,
        pet: arrival.pet,
        appointment: arrival.appointment,
        waitEstimateMinutes: waitMinutes
      },
      runtime,
      options,
      task: arrived.task
    });
  }

  if (intent === "booking") {
    const clientName = normalized.clientName ?? normalized.callerName;
    const clientPhone = normalized.clientPhone ?? normalized.callerPhone;
    const arrival = await executeTool("start_arrival", {
      clientName,
      clientPhone,
      petName: normalized.petName
    }, runtime) as ArrivalResult;
    const client = arrival.client;
    const pet = arrival.pet;
    if (!client || !pet) {
      const taskResult = await executeTool("create_task", {
        status: "pending_review",
        priority: "medium",
        requestType: "scheduling",
        clientName: clientName ?? null,
        clientPhone: clientPhone ?? null,
        petName: normalized.petName ?? null,
        request: `Booking request needs staff review: ${getInputText(normalized) || "Client requested an appointment."}`,
        notes: "Agent needs client and pet confirmation."
      }, runtime) as TaskToolResult;
      return buildResult({
        intent,
        mode,
        message: "I need the front desk to confirm the client and pet before booking. I created a review task.",
        result: { booked: false, needsReview: true },
        runtime,
        options,
        task: taskResult.task
      });
    }

    const slots = await executeTool("list_slots", {
      appointmentType: normalized.appointmentType ?? "Vaccines"
    }, runtime) as {
      slots: { id: string; slotDate: string; slotTime: string; doctor: string; appointmentType: string }[];
    };
    const selected = slots.slots[0] ?? null;
    if (!selected) {
      const taskResult = await executeTool("create_task", {
        status: "pending_review",
        priority: "medium",
        requestType: "scheduling",
        clientName: client.fullName,
        clientPhone: client.phone,
        petName: pet.name,
        request: `No mock slots found for ${normalized.appointmentType ?? "requested appointment"}.`
      }, runtime) as TaskToolResult;
      return buildResult({
        intent,
        mode,
        message: "I did not find a matching slot. Staff has been asked to follow up.",
        result: { booked: false, slots: [] },
        runtime,
        options,
        task: taskResult.task
      });
    }

    const booking = await executeTool("book_appointment", {
      slotId: selected.id,
      clientId: client.id,
      petId: pet.id,
      reason: normalized.appointmentType ?? "Appointment request"
    }, runtime) as BookingToolResult;
    return buildResult({
      intent,
      mode,
      message: `I found ${selected.slotDate} at ${selected.slotTime} with ${selected.doctor}. Staff will confirm this appointment.`,
      result: { booked: booking.booked, slot: booking.slot, client, pet },
      runtime,
      options,
      task: booking.task ?? undefined
    });
  }

  if (intent === "pickup") {
    const arrival = await executeTool("start_arrival", {
      clientName: normalized.clientName ?? normalized.callerName,
      clientPhone: normalized.clientPhone ?? normalized.callerPhone,
      petName: normalized.petName
    }, runtime) as ArrivalResult;
    const pet = arrival.pet;
    const client = arrival.client;
    const wait = pet ? await executeTool("get_wait_status", { petId: pet.id }, runtime) as WaitResult : { waitStatus: null };
    const taskResult = await executeTool("create_task", {
      status: "pending_review",
      priority: "medium",
      requestType: "patient_update",
      clientName: client?.fullName ?? normalized.clientName ?? null,
      clientPhone: client?.phone ?? normalized.clientPhone ?? null,
      petName: pet?.name ?? normalized.petName ?? null,
      request: `Pickup/status request: ${getInputText(normalized) || "Client asked if pet is ready."}`,
      notes: wait.waitStatus ? `Current room status: ${wait.waitStatus.roomStatus}` : "No active status matched."
    }, runtime) as TaskToolResult;
    return buildResult({
      intent,
      mode,
      message: pet
        ? `I asked the team for a pickup status update for ${pet.name}.`
        : "I asked the team to check pickup status manually.",
      result: { pet, client, waitStatus: wait.waitStatus },
      runtime,
      options,
      task: taskResult.task
    });
  }

  return runCallAgent(normalized, options);
}
