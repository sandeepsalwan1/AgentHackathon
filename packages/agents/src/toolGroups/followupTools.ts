import { z } from "zod";
import {
  clientFor,
  defineTool,
  petFor,
  recordEvent,
  type ToolRuntime
} from "../toolCore";

function followupCandidates(runtime: ToolRuntime, status = "open") {
  return runtime.data.followups.filter((followup) => followup.status === status);
}

function sendFollowupOutreach(candidateId: string, runtime: ToolRuntime) {
  const candidate = runtime.data.followups.find((item) => item.id === candidateId) ?? null;
  const client = candidate ? clientFor(runtime.data, candidate.clientId) : null;
  const pet = candidate ? petFor(runtime.data, candidate.petId) : null;
  if (!candidate || !client || !pet) return { candidate, task: null };
  candidate.status = "contacted";
  const outreach = {
    status: "sent",
    channel: "client_portal_mock",
    sentAt: runtime.now.toISOString(),
    message: `${pet.name} is due for ${candidate.followupType}. ${candidate.recommendedAction}`
  };
  recordEvent(runtime, {
    eventType: "followup_outreach_sent",
    title: "Follow-up outreach sent",
    detail: candidate.recommendedAction,
    metadata: {
      candidateId: candidate.id,
      clientId: client.id,
      petId: pet.id,
      channel: outreach.channel,
      action: "followup_outreach_sent"
    }
  });
  return { candidate, client, pet, outreach, task: null };
}

export const followupTools = {
  find_followup_candidates: defineTool({
    description: "Find open follow-up opportunities.",
    parameters: z.object({
      status: z.enum(["open", "contacted", "closed"]).optional()
    }),
    execute: async (args, runtime) => {
      const status = args.status ?? "open";
      const candidates = followupCandidates(runtime, status);
      return { candidates };
    }
  }),
  list_followup_candidates: defineTool({
    description: "List open follow-up candidates.",
    parameters: z.object({
      status: z.enum(["open", "contacted", "closed"]).optional()
    }),
    execute: async (args, runtime) => {
      const candidates = followupCandidates(runtime, args.status ?? "open");
      return { candidates };
    }
  }),
  send_followup_outreach: defineTool({
    description: "Send a mock follow-up outreach message for a due reminder candidate.",
    parameters: z.object({
      candidateId: z.string()
    }),
    execute: async (args, runtime) => sendFollowupOutreach(args.candidateId, runtime)
  }),
  create_followup_task: defineTool({
    description: "Legacy alias for send_followup_outreach; sends mock outreach without creating a task.",
    parameters: z.object({
      candidateId: z.string()
    }),
    execute: async (args, runtime) => sendFollowupOutreach(args.candidateId, runtime)
  })
};
