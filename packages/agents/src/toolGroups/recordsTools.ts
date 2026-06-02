import { z } from "zod";
import { defineTool, id, recordEvent } from "../toolCore";

function recordsTransfer(args: {
  clientName?: string | null;
  petName?: string | null;
  destination?: string | null;
}, sentAt: string) {
  return {
    status: args.destination?.trim() ? "sent" : "blocked",
    delivery: "secure_portal_mock",
    clientName: args.clientName ?? null,
    petName: args.petName ?? null,
    destination: args.destination ?? null,
    confirmationId: id("records-transfer", `${args.clientName ?? "client"}-${args.petName ?? "pet"}-${args.destination ?? "destination"}`),
    sentAt: args.destination?.trim() ? sentAt : null
  };
}

export const recordsTools = {
  request_records_transfer: defineTool({
    description: "Submit a secure mock records transfer for compatibility with older prompts.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const transfer = recordsTransfer(args, runtime.now.toISOString());
      recordEvent(runtime, {
        eventType: "records_transfer_sent",
        title: "Records transfer sent",
        detail: transfer.status === "sent"
          ? `Secure transfer submitted for ${args.destination}.`
          : "Records transfer blocked because destination is missing.",
        metadata: { ...transfer, action: "records_transfer_sent" }
      });
      return { transfer, sent: transfer.status === "sent", recordsSentAutomatically: transfer.status === "sent" };
    }
  }),
  audit_records_transfer: defineTool({
    description: "Run local records-transfer policy audit before automated secure transfer.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const missingDestination = !args.destination?.trim();
      const audit = {
        status: missingDestination ? "blocked" : "passed",
        source: "local_records_policy",
        reason: missingDestination
          ? "Destination is missing; transfer is blocked until a destination is provided."
          : "Client identity and destination fields passed demo transfer policy.",
        checkedAt: runtime.now.toISOString(),
        requiresApproval: false,
        clientName: args.clientName ?? null,
        petName: args.petName ?? null,
        destination: args.destination ?? null
      };
      recordEvent(runtime, {
        eventType: "records_audit_passed",
        title: "Records transfer audited locally",
        detail: audit.reason,
        metadata: audit
      });
      return { audit };
    }
  }),
  prepare_records_packet: defineTool({
    description: "Prepare records metadata for automated secure transfer.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable()
    }),
    execute: async (args) => ({
      packet: {
        clientName: args.clientName ?? null,
        petName: args.petName ?? null,
        destination: args.destination ?? null,
        requiresApproval: false,
        attachments: ["vaccine-summary.pdf", "visit-notes.pdf"]
      }
    })
  }),
  complete_records_transfer: defineTool({
    description: "Submit a secure mock records transfer after the local audit passes.",
    parameters: z.object({
      clientName: z.string().optional().nullable(),
      petName: z.string().optional().nullable(),
      destination: z.string().optional().nullable(),
      request: z.string().optional().nullable()
    }),
    execute: async (args, runtime) => {
      const transfer = recordsTransfer(args, runtime.now.toISOString());
      recordEvent(runtime, {
        eventType: "records_transfer_sent",
        title: "Records transfer sent",
        detail: transfer.status === "sent"
          ? `Secure transfer submitted for ${args.destination}.`
          : "Records transfer blocked because destination is missing.",
        metadata: { ...transfer, action: "records_transfer_sent" }
      });
      return { transfer, sent: transfer.status === "sent", recordsSentAutomatically: transfer.status === "sent" };
    }
  })
};
