import nextEnv from "@next/env";
import path from "node:path";

// Initialize environment variables from root .env.local
const root = path.resolve(import.meta.dirname, "../../..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);

import { runExternalAgent } from "./externalAgent";
import { runInternalAgent } from "./internalAgent";

async function runScenario(name: string, fn: () => Promise<any>) {
  console.log(`\n========================================`);
  console.log(`RUNNING SCENARIO: ${name}`);
  console.log(`========================================`);
  try {
    const result = await fn();
    console.log(`STATUS: ${result.status.toUpperCase()}`);
    console.log(`MESSAGE:`);
    console.log(result.message);
    console.log(`CREATED TASKS:`, result.taskIds);
    console.log(`CREATED APPROVALS:`, result.approvalIds);
    console.log(`EVENTS LOGGED:`, result.events.filter((e: any) => e.eventType === "tool_call").map((e: any) => e.toolName));
    return true;
  } catch (err: any) {
    console.error(`SCENARIO FAILED with error:`, err);
    return false;
  }
}

async function main() {
  console.log("Starting VetAgent Scenario Tests...");
  
  // Set required mock variables in case running direct
  process.env.MOCK_MODE = "true";
  process.env.AGENT_RUNTIME = "mock";

  let success = true;

  // 1. External Checkin Happy Path
  const s1 = await runScenario("Client Check-In (Happy Path)", () => 
    runExternalAgent(
      "Hi, I'm here for Buddy's appointment. Jane Doe.",
      { tenantId: "central-vet", scenario: "checkin" }
    )
  );
  if (!s1) success = false;

  // 2. External Booking Request
  const s2 = await runScenario("Client Reschedule / Booking", () => 
    runExternalAgent(
      "Hi, this is Alice Johnson. Can I reschedule Bella's appointment for next Tuesday at 10 AM?",
      { tenantId: "central-vet", scenario: "booking" }
    )
  );
  if (!s2) success = false;

  // 3. Sick Pet Medical Triage (Guardrail triggering high-priority task)
  const s3 = await runScenario("Sick Pet Emergency (Guardrails)", () => 
    runExternalAgent(
      "Buddy is throwing up, vomiting blood and seems extremely lethargic today.",
      { tenantId: "central-vet", scenario: "sick_pet" }
    )
  );
  if (!s3) success = false;

  // 4. Records Transfer Request (Creating human approval)
  const s4 = await runScenario("Client Records Transfer Request", () => 
    runExternalAgent(
      "Can you request Bella's immunization records from Eastside Vet Clinic?",
      { tenantId: "central-vet", scenario: "records" }
    )
  );
  if (!s4) success = false;

  // 5. Internal Daily Ops Summary
  const s5 = await runScenario("Staff Daily Ops Summary", () => 
    runInternalAgent(
      "Summarize the daily task board queue and status.",
      { tenantId: "central-vet", scenario: "daily_ops" }
    )
  );
  if (!s5) success = false;

  // 6. Internal Competitor Pricing Scan (Apify research comparison)
  const s6 = await runScenario("Competitor Price Scan (Apify Research)", () => 
    runInternalAgent(
      "Run a pricing check on competitor clinics.",
      { tenantId: "central-vet", scenario: "pricing_scan" }
    )
  );
  if (!s6) success = false;

  console.log(`\n========================================`);
  if (success) {
    console.log("ALL SCENARIOS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("SOME SCENARIOS FAILED.");
    process.exit(1);
  }
}

// Check if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
