import { z } from "zod";
import { defineTool, guardrailDecision, triageText } from "../toolCore";

export const safetyTools = {
  triage_message: defineTool({
    description: "Classify client message urgency and intent.",
    parameters: z.object({
      message: z.string()
    }),
    execute: async (args) => triageText(args.message)
  }),
  triage_call: defineTool({
    description: "Classify a phone transcript.",
    parameters: z.object({
      transcript: z.string()
    }),
    execute: async (args) => triageText(args.transcript)
  }),
  check_medical_guardrail: defineTool({
    description: "Check whether medical safety guardrails apply.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("medical", args.text)
  }),
  check_records_guardrail: defineTool({
    description: "Check whether records transfer approval is required.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("records", args.text)
  }),
  check_billing_guardrail: defineTool({
    description: "Check whether billing mutation is blocked.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("billing", args.text)
  }),
  check_pricing_guardrail: defineTool({
    description: "Check whether pricing mutation is blocked.",
    parameters: z.object({ text: z.string() }),
    execute: async (args) => guardrailDecision("pricing", args.text)
  })
};
