import { NextResponse } from "next/server";
import {
  actorSchema,
  authenticateActor,
  canManage,
  logWarn,
  resolveClinicFromRequest
} from "../_shared";

async function readBody(request: Request) {
  return await request.json().catch(() => ({}));
}

async function requireActorFromBody(request: Request) {
  const body = await readBody(request);
  const clinic = await resolveClinicFromRequest(request);
  const actorResult = actorSchema.safeParse(body.actor);
  if (!actorResult.success) {
    return {
      body,
      response: NextResponse.json({ error: "Internal agent routes require actor credentials." }, { status: 403 })
    };
  }
  const auth = await authenticateActor(actorResult.data, request, clinic);
  if ("response" in auth) {
    return { body, response: auth.response };
  }
  return { body, actor: auth.actor, clinic };
}

export async function requireManagerFromBody(request: Request) {
  const auth = await requireActorFromBody(request);
  if ("response" in auth) return auth;
  if (!canManage(auth.actor.role)) {
    logWarn("manager_route_rejected", { actorRole: auth.actor.role });
    return {
      body: auth.body,
      response: NextResponse.json({ error: "Manager access required." }, { status: 403 })
    };
  }
  return auth;
}
