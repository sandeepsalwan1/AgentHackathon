import type { ToolCallTrace } from "@central-vet/agents";
import {
  bookMockAppointment,
  createWorkflowEvent,
  markAppointmentArrived,
  markFollowupContacted,
  type MockAppointment,
  type WorkflowEvent
} from "@central-vet/db";

export async function persistOperationalMutations(runId: string, traceId: string, toolCalls: ToolCallTrace[]) {
  const events: WorkflowEvent[] = [];
  await persistArrivalMutations(toolCalls);
  const appointment = await persistBookingMutations(toolCalls);
  const followup = await persistFollowupMutations(toolCalls);
  if (appointment) {
    events.push(await createWorkflowEvent({
      runId,
      workflowType: "booking",
      eventType: "appointment_booked",
      title: "Mock appointment booked",
      detail: `${appointment.appointmentType} booked for ${appointment.appointmentDate} at ${appointment.appointmentTime}.`,
      metadata: {
        traceId,
        appointmentId: appointment.id,
        slotBooked: true,
        clientId: appointment.clientId,
        petId: appointment.petId
      }
    }));
  }
  if (followup) {
    events.push(await createWorkflowEvent({
      runId,
      workflowType: "followup",
      eventType: "followup_contacted",
      title: "Mock follow-up contacted",
      detail: `${followup.followupType} follow-up marked contacted.`,
      metadata: {
        traceId,
        followupId: followup.id,
        clientId: followup.clientId,
        petId: followup.petId
      }
    }));
  }
  return events;
}

async function persistArrivalMutations(toolCalls: ToolCallTrace[]) {
  const arrival = toolCalls.find((call) =>
    call.toolName === "mark_arrived" &&
    call.result?.arrived === true &&
    call.result?.alreadyArrived !== true
  );
  const appointment = arrival?.result?.appointment;
  if (appointment && typeof appointment === "object" && "id" in appointment && typeof appointment.id === "string") {
    await markAppointmentArrived(appointment.id);
  }
}

async function persistBookingMutations(toolCalls: ToolCallTrace[]): Promise<MockAppointment | null> {
  const booking = toolCalls.find((call) =>
    call.toolName === "book_appointment" &&
    call.result?.booked === true
  );
  if (!booking) return null;
  const slotId = typeof booking.args.slotId === "string" ? booking.args.slotId : null;
  const client = booking.result.client;
  const pet = booking.result.pet;
  const clientId = client && typeof client === "object" && "id" in client && typeof client.id === "string"
    ? client.id
    : null;
  const petId = pet && typeof pet === "object" && "id" in pet && typeof pet.id === "string"
    ? pet.id
    : null;
  if (!slotId || !clientId || !petId) return null;
  return bookMockAppointment({
    slotId,
    clientId,
    petId,
    reason: typeof booking.args.reason === "string" ? booking.args.reason : null
  });
}

async function persistFollowupMutations(toolCalls: ToolCallTrace[]) {
  const outreach = toolCalls.find((call) =>
    (call.toolName === "send_followup_outreach" || call.toolName === "create_followup_task") &&
    call.result?.outreach &&
    typeof call.result.outreach === "object" &&
    "status" in call.result.outreach &&
    call.result.outreach.status === "sent"
  );
  const candidate = outreach?.result?.candidate;
  const followupId = candidate && typeof candidate === "object" && "id" in candidate && typeof candidate.id === "string"
    ? candidate.id
    : null;
  if (!followupId) return null;
  return markFollowupContacted(followupId);
}
