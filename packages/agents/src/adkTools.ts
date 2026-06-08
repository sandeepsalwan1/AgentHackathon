import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { mockClinicData } from "./mockData";
import { createToolRuntime, executeTool, tools, type ToolName, type ToolRuntime } from "./tools";

export const sharedSafeToolNames = [
  "lookup_client",
  "lookup_pet",
  "lookup_appointment",
  "list_slots",
  "start_arrival",
  "get_wait_status",
  "prepare_records_packet",
  "audit_records_transfer",
  "complete_records_transfer",
  "find_followup_candidates",
  "list_followup_candidates",
  "send_followup_outreach",
  "check_records_guardrail",
  "record_tool_call"
] as const satisfies readonly ToolName[];

export const externalToolNames = [
  ...sharedSafeToolNames,
  "create_booking_hold",
  "book_appointment",
  "capture_booking_request",
  "mark_arrived",
  "send_status_update",
  "capture_arrival_exception",
  "send_clinic_inbox_message"
] as const satisfies readonly ToolName[];

export const internalToolNames = [
  ...sharedSafeToolNames,
  "capture_booking_request",
  "create_booking_hold",
  "book_appointment",
  "mark_arrived",
  "mark_pet_ready",
  "send_status_update",
  "capture_arrival_exception",
  "send_clinic_inbox_message",
  "triage_message",
  "triage_call",
  "check_billing_guardrail",
  "check_pricing_guardrail",
  "list_tasks",
  "list_approvals",
  "list_reports",
  "create_task",
  "create_approval",
  "decide_approval",
  "create_agent_report",
  "create_daily_ops_report",
  "update_task",
  "prepare_records_packet",
  "audit_records_transfer",
  "complete_records_transfer",
  "find_followup_candidates",
  "list_followup_candidates",
  "send_followup_outreach",
  "create_followup_task",
  "get_invoice_summary",
  "review_invoice_flags",
  "flag_invoice_issue",
  "list_service_catalog",
  "run_competitor_scan",
  "compare_service_prices",
  "create_price_review_report",
  "list_lab_catalog",
  "lookup_lab_orders",
  "get_lab_result",
  "summarize_lab_result",
  "prepare_lab_client_update",
  "create_lab_followup_task",
  "record_workflow_event"
] as const satisfies readonly ToolName[];

export function createAdkFunctionTools(runtime: ToolRuntime, allowlist: readonly ToolName[] = externalToolNames) {
  const allowed = new Set<ToolName>(allowlist);
  return Object.entries(tools)
    .filter(([name]) => allowed.has(name as ToolName))
    .map(([name, definition]) => {
      const tool = definition as {
        description: string;
        parameters: z.ZodObject<z.ZodRawShape>;
      };
      return new FunctionTool({
        name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args) => executeTool(name as ToolName, args, runtime)
      });
    });
}

const defaultRuntime = createToolRuntime({}, "unknown", {
  clinicData: mockClinicData,
  now: new Date("2026-05-31T12:00:00.000Z")
});

export const externalAdkFunctionTools = createAdkFunctionTools(defaultRuntime, externalToolNames);
export const internalAdkFunctionTools = createAdkFunctionTools(defaultRuntime, internalToolNames);
export const adkFunctionTools = externalAdkFunctionTools;
