import {
  checkoutArrivalRoom,
  createArrivalException,
  getArrivalSettings,
  listArrivalDesk,
  matchArrivalIdentity,
  submitMatchedArrival,
  updateArrivalSettings,
  updateClinicRoom
} from "@central-vet/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  actorSchema,
  authenticateActor,
  authenticateActorFromQuery,
  dbError,
  noStoreHeaders,
  resolveClinicFromRequest
} from "../_shared";
import { canAdmin } from "../../lib/taskWorkflow";

export const dynamic = "force-dynamic";

const questionnaireSchema = z.object({
  visitReasons: z.array(z.string().trim().min(1)).min(1).max(8),
  sickSignsLabel: z.string().trim().min(1).max(120),
  sickSigns: z.array(z.string().trim().min(1)).min(1).max(12),
  specialConcernsLabel: z.string().trim().min(1).max(120),
  vaccineFeelingLabel: z.string().trim().min(1).max(160),
  surgeryAteLabel: z.string().trim().min(1).max(160),
  surgeryFeelingLabel: z.string().trim().min(1).max(160),
  dentalConcernLabel: z.string().trim().min(1).max(160),
  routineConcernLabel: z.string().trim().min(1).max(160)
});

const identitySchema = z.object({
  clientName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(80).optional().nullable(),
  clientPhone: z.string().trim().max(40).optional().nullable(),
  petName: z.string().trim().max(80).optional().nullable()
});

const publicActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("match"),
    identity: identitySchema
  }),
  z.object({
    action: z.literal("submit"),
    identity: identitySchema,
    visitReason: z.string().trim().min(1).max(80),
    answers: z.record(z.string(), z.unknown()).default({})
  })
]);

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("room"),
    actor: actorSchema,
    roomId: z.string().uuid(),
    state: z.enum(["open", "occupied", "closed", "cleaning"])
  }),
  z.object({
    action: z.literal("checkout"),
    actor: actorSchema,
    arrivalId: z.string().uuid()
  }),
  z.object({
    action: z.literal("settings"),
    actor: actorSchema,
    roomAssignmentEnabled: z.boolean(),
    questionnaire: questionnaireSchema
  })
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clinic = await resolveClinicFromRequest(request);
    if (!url.searchParams.has("role")) {
      const settings = await getArrivalSettings({ clinicId: clinic.clinicId });
      return NextResponse.json({ settings }, { headers: noStoreHeaders });
    }

    const auth = await authenticateActorFromQuery(url, request, clinic);
    if ("response" in auth) return auth.response;
    const desk = await listArrivalDesk({ clinicId: clinic.clinicId });
    return NextResponse.json(desk, { headers: noStoreHeaders });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.get" });
  }
}

export async function POST(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const body = publicActionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Use the check-in form." }, { status: 400 });
    }
    const identity = body.data.identity;
    const match = await matchArrivalIdentity({
      clinicId: clinic.clinicId,
      clientName: identity.clientName,
      lastName: identity.lastName,
      clientPhone: identity.clientPhone,
      petName: identity.petName
    });

    if (body.data.action === "match") {
      if (!match) {
        const exception = await createArrivalException({
          clinicId: clinic.clinicId,
          clientName: identity.clientName,
          lastName: identity.lastName,
          clientPhone: identity.clientPhone,
          petName: identity.petName
        });
        return NextResponse.json({
          matched: false,
          message: "Front desk help is ready. We could not safely match one appointment from that info.",
          exception
        });
      }
      return NextResponse.json({ matched: true, match });
    }

    if (!match) {
      const exception = await createArrivalException({
        clinicId: clinic.clinicId,
        clientName: identity.clientName,
        lastName: identity.lastName,
        clientPhone: identity.clientPhone,
        petName: identity.petName,
        reason: "Questionnaire submitted without a safe appointment match."
      });
      return NextResponse.json({
        matched: false,
        message: "Front desk help is ready. We could not safely match one appointment from that info.",
        exception
      }, { status: 409 });
    }

    const arrival = await submitMatchedArrival({
      clinicId: clinic.clinicId,
      match,
      visitReason: body.data.visitReason,
      answers: body.data.answers as Record<string, unknown>
    });
    return NextResponse.json({
      matched: true,
      arrival,
      message: arrival.roomName
        ? `You are checked in. Please go to ${arrival.roomName}.`
        : "You are checked in. The front desk will direct you."
    }, { status: 201 });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.post" });
  }
}

export async function PATCH(request: Request) {
  try {
    const clinic = await resolveClinicFromRequest(request);
    const body = patchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid arrival update." }, { status: 400 });
    }

    const auth = await authenticateActor(body.data.actor, request, clinic);
    if ("response" in auth) return auth.response;
    if (body.data.action === "settings" && !canAdmin(auth.actor.role)) {
      return NextResponse.json({ error: "Admin required." }, { status: 403 });
    }

    if (body.data.action === "room") {
      const room = await updateClinicRoom({
        clinicId: clinic.clinicId,
        roomId: body.data.roomId,
        state: body.data.state
      });
      return NextResponse.json({ room });
    }
    if (body.data.action === "checkout") {
      const room = await checkoutArrivalRoom({
        clinicId: clinic.clinicId,
        arrivalId: body.data.arrivalId
      });
      return NextResponse.json({ room });
    }

    const settings = await updateArrivalSettings({
      clinicId: clinic.clinicId,
      roomAssignmentEnabled: body.data.roomAssignmentEnabled,
      questionnaire: body.data.questionnaire
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return dbError(error, { route: "arrival-intake.patch" });
  }
}
