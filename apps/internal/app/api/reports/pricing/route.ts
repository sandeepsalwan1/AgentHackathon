import { getPricingReports } from "@central-vet/db";
import { dbError } from "../../_shared";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const reports = await getPricingReports();
    return NextResponse.json({ reports });
  } catch (error) {
    return dbError(error, { route: "reports.pricing" });
  }
}
