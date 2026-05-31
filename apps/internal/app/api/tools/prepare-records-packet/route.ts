import { auditRecordsTransfer, buildRecordsTransferPacket } from "@central-vet/agents";
import { createTask, recordTaskEvent } from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sourceForActor } from "../../../lib/taskWorkflow";
import {
  authenticateActor,
  actorSchema,
  canManage,
  dbError,
  logInfo,
  logWarn,
  sanitizeTaskForActor
} from "../../_shared";

const recordSchema = z.object({
  id: z.string().trim().max(120).optional().nullable(),
  name: z.string().trim().max(200).optional().nullable(),
  storagePath: z.string().trim().max(500).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  bytes: z.number().int().nonnegative().optional().nullable()
});

const bodySchema = z.object({
  actor: actorSchema,
  clientId: z.string().trim().max(120).optional().nullable(),
  clientName: z.string().trim().min(1).max(120),
  clientPhone: z.string().trim().max(80).optional().nullable(),
  clientDateOfBirth: z.string().trim().optional().nullable(),
  petId: z.string().trim().max(120).optional().nullable(),
  petName: z.string().trim().min(1).max(120),
  petWeight: z.string().trim().max(80).optional().nullable(),
  lastVisit: z.string().optional().nullable(),
  request: z.string().trim().min(10).max(4000),
  destinationHospital: z.string().trim().max(200).optional().nullable(),
  destinationContact: z.string().trim().max(200).optional().nullable(),
  records: z.array(recordSchema).default([]),
  createTask: z.boolean().default(true),
  status: z.enum(["pending_review", "due", "pending"]).default("pending_review"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable()
});

function priorityForAudit(
  auditStatus: "approved" | "flagged" | "blocked",
  requestedPriority: "low" | "medium" | "high"
) {
  if (auditStatus === "blocked") return "high";
  if (auditStatus === "flagged" && requestedPriority === "low") return "medium";
  return requestedPriority;
}

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      logWarn("prepare_records_packet_rejected", { reason: "invalid_payload" });
      return NextResponse.json({ error: "Invalid records packet request." }, { status: 400 });
    }

    const auth = await authenticateActor(parsed.data.actor, request);
    if ("response" in auth) {
      logWarn("prepare_records_packet_rejected", {
        reason: "invalid_passcode",
        actorRole: parsed.data.actor.role
      });
      return auth.response;
    }
    const actor = auth.actor;
    if (!canManage(actor.role)) {
      logWarn("prepare_records_packet_rejected", {
        reason: "unauthorized",
        actorRole: actor.role
      });
      return NextResponse.json({ error: "Records packet preparation requires VA, Veterinarian, or Admin." }, { status: 403 });
    }

    const packet = buildRecordsTransferPacket({
      clientId: parsed.data.clientId,
      clientName: parsed.data.clientName,
      clientPhone: parsed.data.clientPhone,
      clientDateOfBirth: parsed.data.clientDateOfBirth,
      petId: parsed.data.petId,
      petName: parsed.data.petName,
      petWeight: parsed.data.petWeight,
      lastVisit: parsed.data.lastVisit,
      request: parsed.data.request,
      requestedBy: actor.name,
      destinationHospital: parsed.data.destinationHospital,
      destinationContact: parsed.data.destinationContact,
      records: parsed.data.records,
      metadata: {
        source: "prepare_records_packet",
        actorRole: actor.role,
        recordsCount: parsed.data.records.length
      }
    });
    const audit = await auditRecordsTransfer(packet);

    if (!parsed.data.createTask) {
      return NextResponse.json({ packet, audit });
    }

    const source = sourceForActor(actor.role);
    const task = await createTask(
      {
        status: audit.status === "blocked" ? "pending_review" : parsed.data.status,
        source,
        clientName: parsed.data.clientName,
        clarityId: parsed.data.clientId,
        clientPhone: parsed.data.clientPhone,
        clientDateOfBirth: parsed.data.clientDateOfBirth,
        petName: parsed.data.petName,
        petWeight: parsed.data.petWeight,
        lastVisit: parsed.data.lastVisit,
        request: parsed.data.request,
        requestType: "records_request",
        priority: priorityForAudit(audit.status, parsed.data.priority),
        dueDate: parsed.data.dueDate,
        dueTime: parsed.data.dueTime,
        opseraAuditStatus: audit.status,
        opseraAuditReason: audit.reason,
        opseraAuditId: audit.auditId,
        opseraAuditCheckedAt: audit.checkedAt
      },
      actor
    );
    await recordTaskEvent({
      taskId: task.id,
      actor,
      eventType: "opsera_records_audit",
      previousStatus: null,
      nextStatus: task.status,
      metadata: {
        opseraStatus: audit.status,
        opseraReason: audit.reason,
        opseraAuditId: audit.auditId,
        opseraSource: audit.source,
        recordsCount: parsed.data.records.length
      }
    });
    logInfo("prepare_records_packet_created", {
      taskId: task.id,
      actorRole: actor.role,
      status: audit.status
    });

    return NextResponse.json(
      { packet, audit, task: sanitizeTaskForActor(task, actor.role) },
      { status: 201 }
    );
  } catch (error) {
    return dbError(error, { route: "tools.prepare-records-packet" });
  }
}
