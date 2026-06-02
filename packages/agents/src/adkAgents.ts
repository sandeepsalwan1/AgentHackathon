import { LlmAgent } from "@google/adk";
import { adkFunctionTools, createAdkFunctionTools } from "./adkTools";
import type { ToolRuntime } from "./tools";

const model = process.env.GOOGLE_ADK_MODEL || "gemini-2.5-flash";

const globalInstruction = [
  "You are VetAgent for Central Veterinary Hospital.",
  "Use tools for clinic facts and every state-changing action.",
  "Do not invent clinic facts.",
  "Do not provide diagnosis or treatment advice.",
  "Do not change invoices, service prices, or give medical advice.",
  "Complete matched low-risk workflows directly with mock integration tools.",
  "Do not create HITL approval drafts or pending-review tasks for normal agent conversations.",
  "Return concise JSON with message and result fields when possible."
].join(" ");

const externalInstruction = [
  "Client-facing external agent.",
  "Keep answers short and clear.",
  "For check-in use lookup_client, lookup_pet, lookup_appointment or start_arrival, mark_arrived, get_wait_status; use capture_arrival_exception for missing appointments.",
  "For booking use start_arrival, list_slots, and book_appointment to reserve matched client/pet slots directly.",
  "For pickup use start_arrival, get_wait_status, and send_status_update when a pet is ready.",
  "For follow-up use find_followup_candidates and send_followup_outreach to send mock portal outreach.",
  "For records use prepare_records_packet, audit_records_transfer, and complete_records_transfer.",
  "For sick pets use check_medical_guardrail and dispatch_clinical_triage.",
  "Never claim medical advice was given."
].join(" ");

const internalInstruction = [
  "Staff-facing internal agent.",
  "Rank work and explain reasons.",
  "For daily ops use list_tasks, list_approvals, list_followup_candidates, list_reports, and create_daily_ops_report.",
  "For pricing use list_service_catalog, then run_competitor_scan with source \"apify\" to pull live competitor pricing (it auto-falls back to sample data if live data is unavailable), then compare_service_prices and create_price_review_report.",
  "For invoice audits use review_invoice_flags; never mutate invoices.",
  "For labs use lookup_lab_orders, get_lab_result, summarize_lab_result, and prepare_lab_client_update.",
  "Never mutate invoices or service prices."
].join(" ");

export function createExternalAdkAgent(runtime: ToolRuntime) {
  return new LlmAgent({
    name: "external_vetagent",
    model,
    globalInstruction,
    instruction: externalInstruction,
    tools: createAdkFunctionTools(runtime),
    includeContents: "none",
    disallowTransferToParent: true,
    disallowTransferToPeers: true
  });
}

export function createInternalAdkAgent(runtime: ToolRuntime) {
  return new LlmAgent({
    name: "internal_vetagent",
    model,
    globalInstruction,
    instruction: internalInstruction,
    tools: createAdkFunctionTools(runtime),
    includeContents: "none",
    disallowTransferToParent: true,
    disallowTransferToPeers: true
  });
}

export const externalRootAgent = new LlmAgent({
  name: "external_vetagent",
  model,
  globalInstruction,
  instruction: externalInstruction,
  tools: adkFunctionTools,
  includeContents: "none"
});

export const internalRootAgent = new LlmAgent({
  name: "internal_vetagent",
  model,
  globalInstruction,
  instruction: internalInstruction,
  tools: adkFunctionTools,
  includeContents: "none"
});
