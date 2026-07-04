import { NextResponse } from "next/server";
import { dbError } from "../../_apiResponse";
import { smokeNotificationPayload } from "../_notificationRequest";

export async function POST(request: Request) {
  try {
    const payload = await smokeNotificationPayload(request);
    if ("response" in payload) return payload.response;
    return NextResponse.json(payload.result);
  } catch (error) {
    return dbError(error, { route: "notifications.smoke" });
  }
}
