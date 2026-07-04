import { NextResponse } from "next/server";
import { dbError, noStoreHeaders } from "../../_apiResponse";
import {
  requireManagerFromBody,
  requireManagerFromQuery
} from "../../_shared";
import {
  correctMemoryFromBody,
  createMemoryFromBody,
  deleteMemoryFromBody,
  memoryListPayload
} from "./_memoryRequest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireManagerFromQuery(request);
    if ("response" in auth) return auth.response;
    return NextResponse.json(
      await memoryListPayload(auth.url, auth.clinic.clinicId),
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return dbError(error, { route: "agent.memory.list" });
  }
}

function memoryResponse(result: Awaited<ReturnType<typeof createMemoryFromBody>>) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, memory: result.memory }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    return memoryResponse(await createMemoryFromBody(auth.body, auth.actor, auth.clinic.clinicId));
  } catch (error) {
    return dbError(error, { route: "agent.memory.create" });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    return memoryResponse(await correctMemoryFromBody(auth.body, auth.actor, auth.clinic.clinicId));
  } catch (error) {
    return dbError(error, { route: "agent.memory.correct" });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireManagerFromBody(request);
    if ("response" in auth) return auth.response;
    return memoryResponse(await deleteMemoryFromBody(auth.body, auth.clinic.clinicId));
  } catch (error) {
    return dbError(error, { route: "agent.memory.delete" });
  }
}
