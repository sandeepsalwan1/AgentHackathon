import { Actor, createTask } from "@central-vet/db";

export interface GuardrailResult {
  allowed: boolean;
  escalated: boolean;
  message?: string;
  taskId?: string;
}

/**
 * Checks for medical keywords and diagnoses in client messages.
 * If flagged, automatically escalates to a high-priority staff task and prevents auto-diagnosis.
 */
export async function enforceMedicalGuardrails(
  messageBody: string,
  clientName?: string | null,
  petName?: string | null
): Promise<GuardrailResult> {
  const medicalKeywords = [
    "vomit", "throw up", "blood", "diarrhea", "lethargic", "cough", 
    "bleeding", "broken", "limping", "swelling", "seizure", "collapse", 
    "choking", "poison", "toxin", "pain", "fever", "breathing"
  ];
  
  const hasMedicalKeyword = medicalKeywords.some(keyword => 
    messageBody.toLowerCase().includes(keyword)
  );

  if (hasMedicalKeyword) {
    const actor: Actor = { name: "Medical Guardrail", role: "task_adder" };
    // Create a high priority triage task for the clinic staff
    const task = await createTask({
      status: "due", // staff needs to act immediately
      source: "client_form",
      clientName: clientName || "Unknown Client",
      petName: petName || "Unknown Pet",
      request: `SICK PET TRIAGE: Client reported potential illness/emergency: "${messageBody}"`,
      requestType: "patient_update",
      priority: "high"
    }, actor);

    return {
      allowed: false,
      escalated: true,
      taskId: task.id,
      message: "I cannot diagnose illnesses or recommend medical treatments. I have immediately alerted our veterinary team of your concern, and a clinic staff member will contact you shortly. If this is a life-threatening emergency, please bring your pet to the nearest emergency clinic."
    };
  }

  return { allowed: true, escalated: false };
}

/**
 * Ensures any records release action is intercepted and marked as pending human approval.
 */
export function enforceRecordsGuardrails(requestedAction: string): GuardrailResult {
  if (requestedAction.includes("send_records") || requestedAction.includes("release_records")) {
    return {
      allowed: false,
      escalated: true,
      message: "Records cannot be sent automatically. A transfer request has been placed in the approvals queue for staff verification."
    };
  }
  return { allowed: true, escalated: false };
}

/**
 * Blocks any attempt to write prices or updates directly to the clinic services database.
 */
export function enforcePricingGuardrails(requestedAction: string): GuardrailResult {
  if (requestedAction.includes("update_price") || requestedAction.includes("set_price") || requestedAction.includes("change_catalog")) {
    return {
      allowed: false,
      escalated: true,
      message: "AI agent is not authorized to modify clinic service pricing. Pricing recommendations must be submitted in a review report."
    };
  }
  return { allowed: true, escalated: false };
}
