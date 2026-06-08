import {
  correctAgentMemory,
  createAgentMemory,
  deleteAgentMemory,
  listAgentMemories,
  searchAgentMemories
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateActorFromQuery,
  canManage,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../../_shared";
import { requireManagerFromBody } from "../_auth";

export const dynamic = "force-dynamic";

function limitParam(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? limit : 50;
}

const memoryBodySchema = z.object({
  id: z.string().uuid().optional(),
  subjectType: z.string().trim().min(1).max(80).optional(),
  subjectId: z.string().trim().max(120).optional().nullable(),
  memoryType: z.string().trim().max(80).optional(),
  fact: z.string().trim().min(1).max(1000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  correctionNote: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).passthrough();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    if (!canManage(auth.actor.role)) {
      return NextResponse.json({ error: "Manager access required." }, { status: 403 });
    }
    const query = url.searchParams.get("q")?.trim();
    const options = {
      clinicId: clinic.clinicId,
      subjectType: url.searchParams.get("subjectType"),
      subjectId: url.searchParams.get("subjectId"),
      memoryType: url.searchParams.get("memoryType"),
      limit: limitParam(url.searchParams.get("limit"))
    };
    const memories = query
      ? await searchAgentMemories({ ...options, query })
      : await listAgentMemories(options);
    return NextResponse.json({ ok: true, memories }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.memory.list" });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    const parsed = memoryBodySchema.safeParse(auth.body);
    if (!parsed.success || !parsed.data.subjectType || !parsed.data.fact) {
      return NextResponse.json({ error: "subjectType and fact are required." }, { status: 400 });
    }
    const memory = await createAgentMemory({
      clinicId: auth.clinic.clinicId,
      subjectType: parsed.data.subjectType,
      subjectId: parsed.data.subjectId,
      memoryType: parsed.data.memoryType,
      fact: parsed.data.fact,
      confidence: parsed.data.confidence,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        actor: {
          name: auth.actor.name,
          role: auth.actor.role,
          profileId: auth.actor.profileId ?? null
        }
      }
    });
    return NextResponse.json({ ok: true, memory }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.memory.create" });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    const parsed = memoryBodySchema.safeParse(auth.body);
    if (!parsed.success || !parsed.data.id || !parsed.data.fact) {
      return NextResponse.json({ error: "id and fact are required." }, { status: 400 });
    }
    const memory = await correctAgentMemory(parsed.data.id, {
      clinicId: auth.clinic.clinicId,
      fact: parsed.data.fact,
      confidence: parsed.data.confidence,
      correctionNote: parsed.data.correctionNote,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        correctedBy: {
          name: auth.actor.name,
          role: auth.actor.role,
          profileId: auth.actor.profileId ?? null
        }
      }
    });
    if (!memory) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    return NextResponse.json({ ok: true, memory }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.memory.correct" });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    const parsed = memoryBodySchema.safeParse(auth.body);
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    const memory = await deleteAgentMemory(parsed.data.id, {
      clinicId: auth.clinic.clinicId,
      correctionNote: parsed.data.correctionNote
    });
    if (!memory) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    return NextResponse.json({ ok: true, memory }, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "agent.memory.delete" });
  }
}
