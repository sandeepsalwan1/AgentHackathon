import { z } from "zod";

export interface AgentRunEvent {
  id: string;
  eventType: string;
  toolName?: string | null;
  createdAt: string;
  payload: Record<string, any>;
}

export interface AgentResponse {
  runId: string;
  status: "completed" | "failed" | "needs_approval";
  message: string;
  taskIds: string[];
  approvalIds: string[];
  events: AgentRunEvent[];
}

export interface AgentContext {
  tenantId: string;
  runId?: string;
  scenario?: string;
  actor?: {
    name: string;
    role: string;
  };
}
