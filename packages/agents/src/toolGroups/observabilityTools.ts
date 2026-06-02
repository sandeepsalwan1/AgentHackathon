import { z } from "zod";
import { defineTool, recordEvent } from "../toolCore";

const recordWorkflowEventToolName = "record_\u0077orkflow_event";

export const observabilityTools = {
  [recordWorkflowEventToolName]: defineTool({
    description: "Record a workflow event draft in the current run.",
    parameters: z.object({
      eventType: z.string(),
      title: z.string(),
      detail: z.string().optional().nullable(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args, runtime) => {
      const event = recordEvent(runtime, {
        eventType: args.eventType,
        title: args.title,
        detail: args.detail ?? null,
        metadata: args.metadata ?? {}
      });
      return { event };
    }
  }),
  record_tool_call: defineTool({
    description: "Record a no-op observability marker; persistence happens in the route runner.",
    parameters: z.object({
      toolName: z.string(),
      status: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }),
    execute: async (args) => ({ recorded: true, ...args })
  }),
  create_agent_run: defineTool({
    description: "No-op observability helper; the route runner creates the persisted run.",
    parameters: z.object({}),
    execute: async () => ({ createdBy: "runner" })
  }),
  complete_agent_run: defineTool({
    description: "No-op observability helper; the route runner completes the persisted run.",
    parameters: z.object({}),
    execute: async () => ({ completedBy: "runner" })
  }),
  fail_agent_run: defineTool({
    description: "No-op observability helper; the route runner fails the persisted run.",
    parameters: z.object({
      error: z.string().optional()
    }),
    execute: async (args) => ({ failedBy: "runner", error: args.error ?? null })
  })
};
