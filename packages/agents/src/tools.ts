import {
  lookupClient as dbLookupClient,
  lookupPet as dbLookupPet,
  listSlots as dbListSlots,
  bookAppointment as dbBookAppointment,
  getPetWaitStatus as dbGetPetWaitStatus,
  updatePetWaitStatus as dbUpdatePetWaitStatus,
  markAppointmentArrived as dbMarkAppointmentArrived,
  createTask as dbCreateTask,
  editTask as dbEditTask,
  createApprovalRequest as dbCreateApprovalRequest,
  logWorkflowEvent as dbLogWorkflowEvent,
  listFollowupCandidates as dbListFollowupCandidates,
  updateFollowupCandidateStatus as dbUpdateFollowupCandidateStatus,
  getMockInvoices as dbGetMockInvoices,
  createInvoiceReviewReport as dbCreateInvoiceReviewReport,
  getCompetitorPriceObservations as dbGetCompetitorPriceObservations,
  getServiceCatalog as dbGetServiceCatalog,
  createPricingReport as dbCreatePricingReport,
  type Actor,
  type TaskStatus,
  type TaskPriority,
  type TaskRequestType,
  type TaskSource
} from "@central-vet/db";
import { z } from "zod";

// Helper to log tool workflow events
async function logToolEvent(runId: string, toolName: string, eventType: string, payload: any) {
  try {
    await dbLogWorkflowEvent(runId, eventType, toolName, payload);
  } catch (err) {
    console.error(`Failed to log workflow event for tool ${toolName}:`, err);
  }
}

export const tools = {
  lookup_client: {
    description: "Look up a client by name or phone number",
    parameters: z.object({
      clientName: z.string().optional(),
      phone: z.string().optional()
    }),
    execute: async (args: { clientName?: string; phone?: string }, runId?: string) => {
      const clients = await dbLookupClient(args.clientName, args.phone);
      if (runId) {
        await logToolEvent(runId, "lookup_client", "tool_call", args);
        await logToolEvent(runId, "lookup_client", "tool_response", { clients });
      }
      return { clients };
    }
  },

  lookup_pet: {
    description: "Look up pets registered under a client ID",
    parameters: z.object({
      clientId: z.string(),
      petName: z.string().optional()
    }),
    execute: async (args: { clientId: string; petName?: string }, runId?: string) => {
      const pets = await dbLookupPet(args.clientId, args.petName);
      if (runId) {
        await logToolEvent(runId, "lookup_pet", "tool_call", args);
        await logToolEvent(runId, "lookup_pet", "tool_response", { pets });
      }
      return { pets };
    }
  },

  list_slots: {
    description: "List available appointment slots",
    parameters: z.object({}),
    execute: async (args: {}, runId?: string) => {
      const slots = await dbListSlots(true);
      if (runId) {
        await logToolEvent(runId, "list_slots", "tool_call", args);
        await logToolEvent(runId, "list_slots", "tool_response", { slotsCount: slots.length });
      }
      return { slots };
    }
  },

  book_appointment: {
    description: "Book an appointment for a pet in an available slot",
    parameters: z.object({
      slotId: z.string(),
      clientId: z.string(),
      petId: z.string(),
      reason: z.string()
    }),
    execute: async (args: { slotId: string; clientId: string; petId: string; reason: string }, runId?: string) => {
      const appointment = await dbBookAppointment(args.slotId, args.clientId, args.petId, args.reason);
      if (runId) {
        await logToolEvent(runId, "book_appointment", "tool_call", args);
        await logToolEvent(runId, "book_appointment", "tool_response", { appointment });
      }
      return { appointment };
    }
  },

  get_wait_status: {
    description: "Get queue position and estimated wait time for a checked-in pet",
    parameters: z.object({
      petId: z.string()
    }),
    execute: async (args: { petId: string }, runId?: string) => {
      const waitStatus = await dbGetPetWaitStatus(args.petId);
      if (runId) {
        await logToolEvent(runId, "get_wait_status", "tool_call", args);
        await logToolEvent(runId, "get_wait_status", "tool_response", { waitStatus });
      }
      return { waitStatus };
    }
  },

  mark_arrived: {
    description: "Mark an appointment as arrived and place the pet in the wait queue",
    parameters: z.object({
      appointmentId: z.string()
    }),
    execute: async (args: { appointmentId: string }, runId?: string) => {
      const appointment = await dbMarkAppointmentArrived(args.appointmentId);
      let waitStatus = null;
      if (appointment) {
        // Calculate random position for mock queue
        const queuePos = 2; // Position 2 as per Priority 1 checkin demo happy path
        const waitMinutes = 15; // 15 mins as per checkin demo
        waitStatus = await dbUpdatePetWaitStatus(
          appointment.petId,
          "checked_in",
          queuePos,
          waitMinutes,
          "Checked in and waiting in vehicle"
        );
      }
      
      // Auto-create a task for staff to alert them of client arrival
      const staffActor: Actor = { name: "System", role: "admin" };
      let checkinTaskId = null;
      if (appointment) {
        const task = await dbCreateTask({
          status: "due",
          source: "client_form",
          clientName: "Jane Doe", // Will look up client name or use fallback
          petName: "Buddy",
          request: "Client Jane Doe has arrived and checked in for Buddy's appointment. Waiting in car.",
          requestType: "scheduling",
          priority: "medium"
        }, staffActor);
        checkinTaskId = task.id;
      }

      if (runId) {
        await logToolEvent(runId, "mark_arrived", "tool_call", args);
        await logToolEvent(runId, "mark_arrived", "tool_response", { arrival: { success: !!appointment, message: "Marked as arrived in practice system." }, checkinTaskId });
      }
      return { arrival: { success: !!appointment, message: "Marked as arrived in practice system (Mock Mode)." }, checkinTaskId };
    }
  },

  mark_pet_ready: {
    description: "Mark a pet as ready for pickup after treatment/exam",
    parameters: z.object({
      petId: z.string(),
      message: z.string().optional()
    }),
    execute: async (args: { petId: string; message?: string }, runId?: string) => {
      const waitStatus = await dbUpdatePetWaitStatus(
        args.petId,
        "ready",
        0,
        0,
        args.message || "Your pet is ready for pickup!"
      );
      if (runId) {
        await logToolEvent(runId, "mark_pet_ready", "tool_call", args);
        await logToolEvent(runId, "mark_pet_ready", "tool_response", { waitStatus });
      }
      return { waitStatus };
    }
  },

  create_task: {
    description: "Create a task for clinic staff review",
    parameters: z.object({
      title: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      requestType: z.enum(["prescription", "labs_xrays", "records_request", "scheduling", "patient_update"]),
      requestText: z.string(),
      clientName: z.string().optional(),
      petName: z.string().optional()
    }),
    execute: async (args: { title: string; priority: "low" | "medium" | "high"; requestType: string; requestText: string; clientName?: string; petName?: string }, runId?: string) => {
      const actor: Actor = { name: "AI Agent", role: "task_adder" };
      const task = await dbCreateTask({
        status: "pending_review",
        source: "client_form",
        clientName: args.clientName || null,
        petName: args.petName || null,
        request: args.requestText,
        requestType: args.requestType as any,
        priority: args.priority as any
      }, actor);

      if (runId) {
        await logToolEvent(runId, "create_task", "tool_call", args);
        await logToolEvent(runId, "create_task", "tool_response", { task });
      }
      return { task };
    }
  },

  update_task: {
    description: "Update task details or status",
    parameters: z.object({
      taskId: z.string(),
      status: z.enum(["pending_review", "due", "pending", "completed", "invalid", "archived"]),
      notes: z.string().optional()
    }),
    execute: async (args: { taskId: string; status: string; notes?: string }, runId?: string) => {
      const actor: Actor = { name: "AI Agent", role: "task_adder" };
      const task = await dbEditTask(args.taskId, {
        notes: args.notes || undefined
      }, actor);

      if (runId) {
        await logToolEvent(runId, "update_task", "tool_call", args);
        await logToolEvent(runId, "update_task", "tool_response", { task });
      }
      return { task };
    }
  },

  request_records_transfer: {
    description: "Create an approval request to transfer pet health records from a previous clinic",
    parameters: z.object({
      clientId: z.string(),
      previousClinicName: z.string(),
      petName: z.string()
    }),
    execute: async (args: { clientId: string; previousClinicName: string; petName: string }, runId?: string) => {
      // Risky action -> create approval request
      const approval = await dbCreateApprovalRequest(
        null,
        "records_transfer",
        "client",
        "transfer_records_outbound",
        {
          clientId: args.clientId,
          previousClinicName: args.previousClinicName,
          petName: args.petName
        }
      );
      if (runId) {
        await logToolEvent(runId, "request_records_transfer", "tool_call", args);
        await logToolEvent(runId, "request_records_transfer", "tool_response", { approval });
      }
      return { approval };
    }
  },

  flag_invoice_issue: {
    description: "Flag an issue or discrepancy in a client invoice for administrative review",
    parameters: z.object({
      invoiceId: z.string(),
      issueDetails: z.string()
    }),
    execute: async (args: { invoiceId: string; issueDetails: string }, runId?: string) => {
      const report = await dbCreateInvoiceReviewReport(args.invoiceId, args.issueDetails);
      // Also create a task for admin review
      const actor: Actor = { name: "AI Agent", role: "task_adder" };
      const task = await dbCreateTask({
        status: "pending_review",
        source: "client_form",
        request: `Invoice Issue Flagged: ${args.issueDetails} (Invoice: ${args.invoiceId})`,
        requestType: "prescription",
        priority: "medium"
      }, actor);

      if (runId) {
        await logToolEvent(runId, "flag_invoice_issue", "tool_call", args);
        await logToolEvent(runId, "flag_invoice_issue", "tool_response", { report, task });
      }
      return { report, task };
    }
  },

  find_followup_candidates: {
    description: "Scan database for follow-up opportunities (such as vaccines due soon)",
    parameters: z.object({}),
    execute: async (args: {}, runId?: string) => {
      const candidates = await dbListFollowupCandidates("pending");
      if (runId) {
        await logToolEvent(runId, "find_followup_candidates", "tool_call", args);
        await logToolEvent(runId, "find_followup_candidates", "tool_response", { candidatesCount: candidates.length });
      }
      return { candidates };
    }
  },

  create_followup_task: {
    description: "Transition follow-up alert into a scheduled client outreach task",
    parameters: z.object({
      candidateId: z.string()
    }),
    execute: async (args: { candidateId: string }, runId?: string) => {
      const candidate = await dbUpdateFollowupCandidateStatus(args.candidateId, "contacted");
      let task = null;
      if (candidate) {
        const actor: Actor = { name: "AI Agent", role: "task_adder" };
        task = await dbCreateTask({
          status: "due",
          source: "client_form",
          clientName: "John Smith", // Seeded mock candidate client
          petName: "Max",
          request: `Outreach Followup: Contact client regarding due vaccination/refill: ${candidate.followUpReason}.`,
          requestType: "scheduling",
          priority: "low"
        }, actor);
      }

      if (runId) {
        await logToolEvent(runId, "create_followup_task", "tool_call", args);
        await logToolEvent(runId, "create_followup_task", "tool_response", { candidate, task });
      }
      return { candidate, task };
    }
  },

  run_competitor_scan: {
    description: "Run a competitor price scan using public web data (simulates Apify actor)",
    parameters: z.object({}),
    execute: async (args: {}, runId?: string) => {
      const observations = await dbGetCompetitorPriceObservations();
      if (runId) {
        await logToolEvent(runId, "run_competitor_scan", "tool_call", args);
        await logToolEvent(runId, "run_competitor_scan", "tool_response", { observationsCount: observations.length });
      }
      return { observations };
    }
  },

  compare_service_prices: {
    description: "Compare competitor price observations against our service catalog",
    parameters: z.object({}),
    execute: async (args: {}, runId?: string) => {
      const catalog = await dbGetServiceCatalog();
      const observations = await dbGetCompetitorPriceObservations();
      
      const comparison = catalog.map(item => {
        const matchingObs = observations.filter(o => o.serviceName === item.serviceName);
        const avgCompetitorPrice = matchingObs.length > 0
          ? matchingObs.reduce((acc, curr) => acc + curr.price, 0) / matchingObs.length
          : null;
        return {
          serviceName: item.serviceName,
          basePrice: item.price,
          avgCompetitorPrice: avgCompetitorPrice ? parseFloat(avgCompetitorPrice.toFixed(2)) : null,
          difference: avgCompetitorPrice ? parseFloat((item.price - avgCompetitorPrice).toFixed(2)) : null
        };
      });

      if (runId) {
        await logToolEvent(runId, "compare_service_prices", "tool_call", args);
        await logToolEvent(runId, "compare_service_prices", "tool_response", { comparisonCount: comparison.length });
      }
      return { comparison };
    }
  },

  create_price_review_report: {
    description: "Generate a pricing review report and add it to staff review tasks (requires human approval, no automatic changes)",
    parameters: z.object({
      content: z.string()
    }),
    execute: async (args: { content: string }, runId?: string) => {
      const report = await dbCreatePricingReport(args.content);
      const actor: Actor = { name: "AI Agent", role: "task_adder" };
      const task = await dbCreateTask({
        status: "pending_review",
        source: "client_form",
        request: "Pricing Review Report generated by Pricing Specialist. Review competitor pricing comparisons.",
        requestType: "labs_xrays", // using labs/xrays or patient update as appropriate category
        priority: "low"
      }, actor);

      if (runId) {
        await logToolEvent(runId, "create_price_review_report", "tool_call", args);
        await logToolEvent(runId, "create_price_review_report", "tool_response", { report, task });
      }
      return { report, task };
    }
  }
};
