import { AgentResponse, AgentContext } from "./contracts";
import { tools } from "./tools";
import {
  createWorkflowRun,
  updateWorkflowRunStatus,
  logAgentTrace,
  createTask,
  Actor
} from "@central-vet/db";
import { enforceMedicalGuardrails } from "./guardrails";

export async function runMockAgent(
  agentType: "external" | "internal",
  scenario: string,
  message: string,
  context: AgentContext
): Promise<AgentResponse> {
  const metadata = { inputMessage: message, ...context };
  
  // 1. Initialize run in database
  const run = await createWorkflowRun(agentType, scenario, metadata);
  const runId = run.id;

  const taskIds: string[] = [];
  const approvalIds: string[] = [];
  const events: any[] = [];

  let finalMessage = "";

  // Helper to execute tools and gather output
  async function callTool(toolName: string, args: any) {
    const tool = (tools as any)[toolName];
    if (tool) {
      const result = await tool.execute(args, runId);
      events.push({
        id: Math.random().toString(36).substring(7),
        eventType: "tool_call",
        toolName,
        createdAt: new Date().toISOString(),
        payload: args
      });
      events.push({
        id: Math.random().toString(36).substring(7),
        eventType: "tool_response",
        toolName,
        createdAt: new Date().toISOString(),
        payload: result
      });
      return result;
    }
    throw new Error(`Tool not found: ${toolName}`);
  }

  try {
    // 2. Run Guardrails (Triage medical queries first)
    if (agentType === "external" && (scenario === "sick_pet" || scenario === "triage" || scenario === "checkin")) {
      // Find client/pet name if possible or use default
      const clientName = message.includes("Jane Doe") ? "Jane Doe" : null;
      const petName = message.includes("Buddy") ? "Buddy" : null;
      const guardrail = await enforceMedicalGuardrails(message, clientName, petName);
      if (!guardrail.allowed) {
        if (guardrail.taskId) taskIds.push(guardrail.taskId);
        finalMessage = guardrail.message || "";
        await updateWorkflowRunStatus(runId, "completed", { status: "escalated" });
        await logAgentTrace(runId, message, finalMessage);
        
        return {
          runId,
          status: "completed",
          message: finalMessage,
          taskIds,
          approvalIds,
          events
        };
      }
    }

    // 3. Scenario Executions (Deterministic Agent Loop)
    if (scenario === "checkin") {
      // Lookup Client
      const clientRes = await callTool("lookup_client", { clientName: "Jane Doe" });
      const client = clientRes.clients[0];
      
      if (client) {
        // Lookup Pet
        const petRes = await callTool("lookup_pet", { clientId: client.id, petName: "Buddy" });
        const pet = petRes.pets[0];
        
        if (pet) {
          // Checkin and place in queue (uses Buddy's hardcoded appointment ID from seed data)
          const apptId = "a8d10001-a1b2-c3d4-e5f6-7890abcdef01";
          const checkinRes = await callTool("mark_arrived", { appointmentId: apptId });
          if (checkinRes.checkinTaskId) taskIds.push(checkinRes.checkinTaskId);
          
          // Get queue wait status
          const waitRes = await callTool("get_wait_status", { petId: pet.id });
          const wait = waitRes.waitStatus;
          
          finalMessage = `Hello Jane Doe! Buddy has been checked in. You are currently position #${wait.queuePosition} in the wait queue, and the estimated wait time is ${wait.waitMinutes} minutes.`;
        } else {
          finalMessage = "Jane, we matched your details but couldn't find your pet Buddy in our system. Let me raise this to our reception desk.";
        }
      } else {
        finalMessage = "I couldn't find a client account matching that name. Let me request assistance from the front desk.";
      }
    } 
    else if (scenario === "booking") {
      // Client lookup
      const clientRes = await callTool("lookup_client", { clientName: "Alice Johnson" });
      const client = clientRes.clients[0];
      
      if (client) {
        const petRes = await callTool("lookup_pet", { clientId: client.id, petName: "Bella" });
        const pet = petRes.pets[0];
        
        if (pet) {
          // List slots
          const slotsRes = await callTool("list_slots", {});
          const firstAvailableSlot = slotsRes.slots[1]; // slot Tuesday 10 AM (second slot in seed data)
          
          if (firstAvailableSlot) {
            // Book slot
            const bookRes = await callTool("book_appointment", {
              slotId: firstAvailableSlot.id,
              clientId: client.id,
              petId: pet.id,
              reason: "Vaccines booster recheck"
            });
            
            finalMessage = `I have successfully booked Bella for her Vaccines on Tuesday at 10:00 AM with Dr. Shiv. You will receive a confirmation text shortly.`;
          } else {
            finalMessage = "I see Bella's profile, but we don't have any open slots matching that time. I have created a scheduling task for our reception team.";
          }
        }
      }
    }
    else if (scenario === "pickup" || message.toLowerCase().includes("ready")) {
      const clientRes = await callTool("lookup_client", { clientName: "Jane Doe" });
      const client = clientRes.clients[0];
      if (client) {
        const petRes = await callTool("lookup_pet", { clientId: client.id, petName: "Buddy" });
        const pet = petRes.pets[0];
        if (pet) {
          const waitRes = await callTool("get_wait_status", { petId: pet.id });
          finalMessage = "Buddy is currently checked in. Estimated wait time is 15 minutes.";
        }
      }
    }
    else if (scenario === "records") {
      const clientRes = await callTool("lookup_client", { clientName: "Alice Johnson" });
      const client = clientRes.clients[0];
      if (client) {
        const transferRes = await callTool("request_records_transfer", {
          clientId: client.id,
          petName: "Bella",
          previousClinicName: "Eastside Vet Clinic"
        });
        if (transferRes.approval) {
          approvalIds.push(transferRes.approval.id);
        }
        finalMessage = "I have submitted a records transfer request to Eastside Vet Clinic for Bella. This is currently pending approval by our staff.";
      }
    }
    else if (scenario === "daily_ops") {
      const followupRes = await callTool("find_followup_candidates", {});
      const invoicesRes = await callTool("find_followup_candidates", {}); // mock scan invoices
      
      finalMessage = `Daily Ops Summary:
1. Checked-in pets: 1 active check-in (Buddy / Jane Doe).
2. Follow-ups pending: ${followupRes.candidates.length} candidate(s) (e.g. John Smith's Max due for Rabies Booster).
3. Unpaid Invoices: Jane Doe ($250.00).

Staff actions are logged.`;
    }
    else if (scenario === "pricing_scan") {
      // Scrapes competitor listings
      const scanRes = await callTool("run_competitor_scan", {});
      const compareRes = await callTool("compare_service_prices", {});
      
      const reportText = `Competitor Price Scan Report:
- Vet Care Center is on average 12% more expensive across core services.
- Happy Paws Center is on average 8% cheaper for Annual Exams but 15% more expensive for Dental Cleaning.
Recommendation: Keep current prices stable but audit Dental Cleaning rates in Q3.`;
      
      const reportRes = await callTool("create_price_review_report", { content: reportText });
      if (reportRes.task) {
        taskIds.push(reportRes.task.id);
      }
      
      finalMessage = "Competitor pricing scan completed. pricing report generated and review task created for administration.";
    }
    else if (scenario === "followup") {
      // Find candidate
      const candidateRes = await callTool("find_followup_candidates", {});
      const candidate = candidateRes.candidates[0]; // John Smith Max
      if (candidate) {
        const createTaskRes = await callTool("create_followup_task", { candidateId: candidate.id });
        if (createTaskRes.task) taskIds.push(createTaskRes.task.id);
        finalMessage = `Outreach task generated to follow up with John Smith for Max's Rabies Booster due on ${candidate.dueDate}.`;
      } else {
        finalMessage = "No pending follow-up candidates found.";
      }
    }
    else if (scenario === "invoice") {
      // Invoice issue scan
      const reportRes = await callTool("flag_invoice_issue", {
        invoiceId: "18d10002-a1b2-c3d4-e5f6-7890abcdef02",
        issueDetails: "Unusual surcharge on medication invoice. Standard price is $180, billed $250."
      });
      if (reportRes.task) taskIds.push(reportRes.task.id);
      finalMessage = "Invoice discrepancy flagged. Review task generated for the billing department.";
    }
    else {
      // Default fallback chat response
      finalMessage = "Hello! I am Central Veterinary Hospital's agent. How can I help you today?";
    }

    // 4. Update run status and trace
    await updateWorkflowRunStatus(runId, "completed");
    await logAgentTrace(runId, message, finalMessage);

    return {
      runId,
      status: "completed",
      message: finalMessage,
      taskIds,
      approvalIds,
      events
    };

  } catch (err: any) {
    await updateWorkflowRunStatus(runId, "failed", { error: err.message });
    return {
      runId,
      status: "failed",
      message: `Execution failed: ${err.message}`,
      taskIds,
      approvalIds,
      events
    };
  }
}
