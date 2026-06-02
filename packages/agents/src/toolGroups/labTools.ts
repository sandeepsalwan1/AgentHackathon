import { z } from "zod";
import type { MockClinicData, MockLabOrder } from "../contracts";
import {
  clientFor,
  defineTool,
  looseMatch,
  petFor,
  recordEvent,
  type ToolRuntime
} from "../toolCore";

function firstLabOrder(data: MockClinicData, args: { clientId?: string; petId?: string; status?: string; patientName?: string }) {
  return (data.labOrders ?? []).find((order) => {
    if (args.clientId && order.clientId !== args.clientId) return false;
    if (args.petId && order.petId !== args.petId) return false;
    if (args.status && order.status !== args.status) return false;
    if (args.patientName && !looseMatch(order.patientName, args.patientName)) return false;
    return true;
  }) ?? null;
}

function prepareLabClientUpdate(order: MockLabOrder | null, runtime: ToolRuntime) {
  const result = order ? (runtime.data.labResults ?? []).find((item) => item.labOrderId === order.id) ?? null : null;
  const client = order ? clientFor(runtime.data, order.clientId) : null;
  const pet = order ? petFor(runtime.data, order.petId) : null;
  const abnormal = Boolean(result?.abnormalFlags?.length);
  const update = {
    action: abnormal ? "lab_client_update_held" : "lab_client_update_prepared",
    status: abnormal ? "held_for_doctor" : "prepared",
    delivery: "client_portal_mock",
    clientName: client?.fullName ?? null,
    clientPhone: client?.phone ?? null,
    petName: pet?.name ?? order?.patientName ?? null,
    labVendor: order?.labVendor ?? "antech_mock",
    externalOrderId: order?.externalOrderId ?? null,
    abnormalFlags: result?.abnormalFlags ?? [],
    message: abnormal
      ? "Lab result summary prepared; abnormal flags are held from client delivery until doctor release."
      : "Lab result summary prepared for client portal delivery.",
    medicalAdviceGiven: false,
    preparedAt: runtime.now.toISOString()
  };
  recordEvent(runtime, {
    eventType: update.action,
    title: abnormal ? "Lab client update held" : "Lab client update prepared",
    detail: "No diagnosis or treatment recommendation was provided.",
    metadata: update
  });
  return { update, order, result, client, pet };
}

export const labTools = {
  list_lab_catalog: defineTool({
    description: "List mock lab catalog entries shaped like a future Antech adapter.",
    parameters: z.object({
      active: z.boolean().optional()
    }),
    execute: async (args, runtime) => {
      const catalog = (runtime.data.labCatalog ?? []).filter((item) =>
        typeof args.active === "boolean" ? item.active === args.active : true
      );
      return { labVendor: "antech_mock", catalog };
    }
  }),
  lookup_lab_orders: defineTool({
    description: "Look up mock lab orders by patient, client, pet, or status.",
    parameters: z.object({
      clientId: z.string().optional(),
      petId: z.string().optional(),
      patientName: z.string().optional(),
      status: z.enum(["ordered", "in_progress", "partial", "final", "cancelled"]).optional()
    }),
    execute: async (args, runtime) => {
      const orders = (runtime.data.labOrders ?? []).filter((order) => {
        if (args.clientId && order.clientId !== args.clientId) return false;
        if (args.petId && order.petId !== args.petId) return false;
        if (args.patientName && !looseMatch(order.patientName, args.patientName)) return false;
        if (args.status && order.status !== args.status) return false;
        return true;
      });
      return { labVendor: "antech_mock", orders };
    }
  }),
  get_lab_result: defineTool({
    description: "Fetch mock lab result metadata for an order/accession.",
    parameters: z.object({
      labOrderId: z.string().optional(),
      externalOrderId: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const result = (runtime.data.labResults ?? []).find((item) =>
        (args.labOrderId && item.labOrderId === args.labOrderId) ||
        (args.externalOrderId && item.externalOrderId === args.externalOrderId)
      ) ?? null;
      const order = result
        ? (runtime.data.labOrders ?? []).find((item) => item.id === result.labOrderId) ?? null
        : null;
      return { labVendor: "antech_mock", order, result };
    }
  }),
  summarize_lab_result: defineTool({
    description: "Summarize mock lab result without giving diagnosis or treatment advice.",
    parameters: z.object({
      labOrderId: z.string().optional(),
      externalOrderId: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const result = (runtime.data.labResults ?? []).find((item) =>
        (args.labOrderId && item.labOrderId === args.labOrderId) ||
        (args.externalOrderId && item.externalOrderId === args.externalOrderId)
      ) ?? null;
      const order = result
        ? (runtime.data.labOrders ?? []).find((item) => item.id === result.labOrderId) ?? null
        : firstLabOrder(runtime.data, { status: "final" });
      const summary = result
        ? {
            labVendor: result.labVendor,
            source: "mock lab data",
            externalOrderId: result.externalOrderId,
            status: result.status,
            resultSummary: result.resultSummary,
            abnormalFlags: result.abnormalFlags,
            reportUrl: result.reportUrl,
            medicalAdviceGiven: false
          }
        : {
            labVendor: "antech_mock",
            source: "mock lab data",
            status: order?.status ?? "not_found",
            resultSummary: "No finalized mock lab result matched.",
            abnormalFlags: [],
            reportUrl: null,
            medicalAdviceGiven: false
          };
      return { order, result, summary };
    }
  }),
  prepare_lab_client_update: defineTool({
    description: "Prepare a mock lab-result client update without giving medical advice or creating a task.",
    parameters: z.object({
      labOrderId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const order = (runtime.data.labOrders ?? []).find((item) => item.id === args.labOrderId) ?? null;
      return { ...prepareLabClientUpdate(order, runtime), medicalAdviceGiven: false };
    }
  }),
  create_lab_followup_task: defineTool({
    description: "Legacy alias for prepare_lab_client_update; no task is created.",
    parameters: z.object({
      labOrderId: z.string(),
      reason: z.string().optional()
    }),
    execute: async (args, runtime) => {
      const order = (runtime.data.labOrders ?? []).find((item) => item.id === args.labOrderId) ?? null;
      return { ...prepareLabClientUpdate(order, runtime), task: null, medicalAdviceGiven: false };
    }
  })
};
