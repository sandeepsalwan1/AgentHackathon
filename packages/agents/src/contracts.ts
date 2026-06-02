import type { MockLabCatalogItem, MockLabOrder, MockLabResult } from "@central-vet/db";
import { z } from "zod";

export type { MockLabCatalogItem, MockLabOrder, MockLabResult };

export const agentIntentSchema = z.enum([
  "booking",
  "call",
  "checkin",
  "daily_ops",
  "followup",
  "invoice",
  "labs",
  "pickup",
  "pricing",
  "records",
  "sick_pet",
  "unknown"
]);

export const agentModeSchema = z.enum(["mock", "google-adk", "apify", "e2b-local", "e2b"]);

export const actorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(["staff", "va", "task_adder", "veterinarian", "admin"]).optional(),
  profileId: z.string().optional().nullable()
});

export const agentInputSchema = z.object({
  intent: agentIntentSchema.optional(),
  scenario: agentIntentSchema.optional(),
  message: z.string().optional(),
  request: z.string().optional(),
  transcript: z.string().optional(),
  body: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  callerName: z.string().optional(),
  callerPhone: z.string().optional(),
  petName: z.string().optional(),
  appointmentType: z.string().optional(),
  destination: z.string().optional(),
  live: z.boolean().optional(),
  actor: actorSchema.optional()
}).passthrough();

export type AgentIntent = z.infer<typeof agentIntentSchema>;
export type AgentMode = z.infer<typeof agentModeSchema>;
export type AgentInput = z.infer<typeof agentInputSchema>;
export type Actor = z.infer<typeof actorSchema>;

export type TaskPriority = "low" | "medium" | "high";
export type TaskRequestType =
  | "prescription"
  | "labs_xrays"
  | "records_request"
  | "scheduling"
  | "patient_update";

export type AgentTaskDraft = {
  id: string;
  kind: "task";
  status: "pending_review" | "due" | "pending";
  priority: TaskPriority;
  requestType: TaskRequestType;
  clientName: string | null;
  clientPhone: string | null;
  petName: string | null;
  request: string;
  notes: string | null;
  dueTimeHint?: string;
};

export type AgentApprovalDraft = {
  id: string;
  kind: "approval";
  approvalType: "records_transfer" | "billing_review" | "pricing_review";
  title: string;
  summary: string;
  requestedAction: Record<string, unknown>;
  taskId?: string | null;
};

export type AgentReportDraft = {
  id: string;
  kind: "report";
  reportType: "daily_ops" | "followup" | "invoice" | "pricing";
  title: string;
  summary: string;
  data: Record<string, unknown>;
  taskId?: string | null;
};

export type WorkflowEventDraft = {
  id: string;
  workflowType: AgentIntent;
  eventType: string;
  title: string;
  detail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ToolCallTrace = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  status?: "ok" | "error";
  error?: string | null;
  durationMs?: number;
  createdAt: string;
};

export type AgentEffect =
  | AgentTaskDraft
  | AgentApprovalDraft
  | AgentReportDraft
  | WorkflowEventDraft;

export type AgentWorkflowResult = {
  ok: true;
  mode: AgentMode;
  intent: AgentIntent;
  message: string;
  result: Record<string, unknown>;
  task?: AgentTaskDraft;
  approval?: AgentApprovalDraft;
  report?: AgentReportDraft;
  workflowEvents: WorkflowEventDraft[];
  runId: string;
  effects: AgentEffect[];
  toolCalls: ToolCallTrace[];
};

export type RunAgentOptions = {
  mode?: AgentMode;
  runId?: string;
  traceId?: string;
  routeIntent?: string;
  now?: Date;
  model?: string;
  clinicData?: MockClinicData;
};

export type MockClient = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  notes?: string;
};

export type MockPet = {
  id: string;
  clientId: string;
  name: string;
  species: string;
  breed?: string;
  alerts?: string;
};

export type MockAppointment = {
  id: string;
  clientId: string;
  petId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  doctor: string;
  status: "scheduled" | "arrived" | "ready" | "completed";
  waitMinutes: number;
  roomStatus: "waiting" | "checked in" | "ready" | "complete";
  notes?: string;
};

export type MockSlot = {
  id: string;
  slotDate: string;
  slotTime: string;
  doctor: string;
  appointmentType: string;
  available: boolean;
};

export type MockFollowup = {
  id: string;
  clientId: string;
  petId: string;
  followupType: string;
  dueDate: string;
  recommendedAction: string;
  status: "open" | "contacted" | "closed";
};

export type MockInvoice = {
  id: string;
  clientId: string;
  petId: string;
  invoiceNumber: string;
  status: "paid" | "unpaid" | "review";
  totalCents: number;
  flags: { reason: string; severity: TaskPriority }[];
};

export type MockService = {
  id: string;
  serviceName: string;
  category: string;
  currentPriceCents: number;
};

export type PricingObservation = {
  id: string;
  source: "sample" | "apify";
  competitorName: string;
  serviceName: string;
  observedPriceCents: number | null;
  observedText?: string;
  url?: string;
};

export type MockTask = {
  id: string;
  status: string;
  priority: TaskPriority;
  requestType?: TaskRequestType;
  clientName?: string | null;
  petName?: string | null;
  request: string;
  notes?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
};

export type MockApproval = {
  id: string;
  status: string;
  approvalType: string;
  title: string;
  summary: string;
  taskId?: string | null;
};

export type MockReport = {
  id: string;
  reportType: string;
  title: string;
  summary: string;
  taskId?: string | null;
};

export type MockMessage = {
  id: string;
  clientId: string | null;
  body: string;
  intentHint?: AgentIntent;
  urgency: "normal" | "high";
};

export type MockCallTranscript = {
  id: string;
  callerName: string;
  callerPhone: string;
  transcript: string;
  intentHint?: AgentIntent;
};

export type MockClinicData = {
  clients: MockClient[];
  pets: MockPet[];
  appointments: MockAppointment[];
  slots: MockSlot[];
  followups: MockFollowup[];
  invoices: MockInvoice[];
  services: MockService[];
  pricingObservations: PricingObservation[];
  messages: MockMessage[];
  calls: MockCallTranscript[];
  tasks?: MockTask[];
  approvals?: MockApproval[];
  reports?: MockReport[];
  labCatalog?: MockLabCatalogItem[];
  labOrders?: MockLabOrder[];
  labResults?: MockLabResult[];
};
