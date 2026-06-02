import { z } from "zod";
import type { MockClinicData } from "../contracts";
import {
  addEffect,
  clientFor,
  defineTool,
  firstClient,
  firstPet,
  makeReport,
  petFor,
  recordEvent
} from "../toolCore";

function invoiceContext(data: MockClinicData, invoiceId: string) {
  const invoice = data.invoices.find((candidate) => candidate.id === invoiceId) ?? null;
  const client = invoice ? clientFor(data, invoice.clientId) : null;
  const pet = invoice ? petFor(data, invoice.petId) : null;
  return { invoice, client, pet };
}

function createInvoiceReview(invoiceId: string, issueDetails: string, runtime: Parameters<typeof recordEvent>[0]) {
  const { invoice, client, pet } = invoiceContext(runtime.data, invoiceId);
  const report = addEffect(runtime, makeReport({
    reportType: "invoice",
    title: "Invoice review",
    summary: issueDetails,
    taskId: null,
    data: { invoice, client, pet, changedInvoices: false }
  }));
  recordEvent(runtime, {
    eventType: "invoice_review_report_created",
    title: "Invoice review report created",
    detail: issueDetails,
    metadata: { invoiceId, reportId: report.id, changedInvoices: false }
  });
  return { invoice, client, pet, report, changedInvoices: false };
}

export const billingTools = {
  get_invoice_summary: defineTool({
    description: "Return invoice data for review.",
    parameters: z.object({
      clientName: z.string().optional(),
      petName: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const client = firstClient(runtime.data, args.clientName);
      const pet = client ? firstPet(runtime.data, client.id, args.petName) : null;
      const invoices = runtime.data.invoices.filter((invoice) =>
        (!client || invoice.clientId === client.id) && (!pet || invoice.petId === pet.id)
      );
      return { client, pet, invoices };
    }
  }),
  review_invoice_flags: defineTool({
    description: "Create a mock invoice audit report without mutating billing or creating a review task.",
    parameters: z.object({
      invoiceId: z.string(),
      issueDetails: z.string()
    }),
    execute: async (args, runtime) => createInvoiceReview(args.invoiceId, args.issueDetails, runtime)
  }),
  flag_invoice_issue: defineTool({
    description: "Legacy alias for review_invoice_flags; returns a report only, no task.",
    parameters: z.object({
      invoiceId: z.string(),
      issueDetails: z.string()
    }),
    execute: async (args, runtime) => createInvoiceReview(args.invoiceId, args.issueDetails, runtime)
  })
};
