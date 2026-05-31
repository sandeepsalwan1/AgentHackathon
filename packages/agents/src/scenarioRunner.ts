import { runInSandbox } from "./e2bRunner";
import { runExternalAgent } from "./externalAgent";
import { runInternalAgent } from "./internalAgent";
import type { AgentWorkflowResult } from "./contracts";

type Scenario = {
  name: string;
  run: () => Promise<AgentWorkflowResult>;
  expect: (result: AgentWorkflowResult) => string | null;
};

function expectIntent(intent: AgentWorkflowResult["intent"]) {
  return (result: AgentWorkflowResult) =>
    result.intent === intent ? null : `Expected intent ${intent}, got ${result.intent}`;
}

function expectTask(result: AgentWorkflowResult) {
  return result.task ? null : "Expected a staff task draft";
}

function expectApproval(result: AgentWorkflowResult) {
  return result.approval ? null : "Expected an approval draft";
}

function all(...checks: Array<(result: AgentWorkflowResult) => string | null>) {
  return (result: AgentWorkflowResult) => {
    for (const check of checks) {
      const message = check(result);
      if (message) return message;
    }
    return null;
  };
}

export const scenarios: Scenario[] = [
  {
    name: "arrival happy path",
    run: () => runExternalAgent({
      clientName: "Maya Parker",
      clientPhone: "(415) 555-0134",
      petName: "Biscuit",
      message: "I'm outside for my appointment. Can you check me in?"
    }),
    expect: all(expectIntent("checkin"), expectTask)
  },
  {
    name: "arrival no appointment",
    run: () => runExternalAgent({
      clientName: "Unknown Client",
      petName: "Ghost",
      message: "I'm here for my appointment."
    }),
    expect: all(expectIntent("checkin"), expectTask)
  },
  {
    name: "booking happy path",
    run: () => runExternalAgent({
      clientName: "Alice Johnson",
      petName: "Bella",
      appointmentType: "Vaccines",
      message: "Can I book Bella for vaccines next Tuesday?"
    }),
    expect: all(expectIntent("booking"), expectTask)
  },
  {
    name: "booking ambiguous",
    run: () => runExternalAgent({
      message: "Can I get the first appointment after 3?"
    }),
    expect: all(expectIntent("booking"), expectTask)
  },
  {
    name: "sick-pet emergency",
    run: () => runExternalAgent({
      clientName: "Jane Doe",
      petName: "Buddy",
      message: "Buddy is vomiting blood and very lethargic."
    }),
    expect: all(expectIntent("sick_pet"), expectTask)
  },
  {
    name: "records transfer",
    run: () => runExternalAgent({
      clientName: "Alice Johnson",
      petName: "Bella",
      destination: "Eastside Vet Clinic",
      message: "Please transfer Bella's records to Eastside Vet Clinic."
    }),
    expect: all(expectIntent("records"), expectTask, expectApproval)
  },
  {
    name: "pickup status",
    run: () => runExternalAgent({
      clientName: "Jane Doe",
      petName: "Buddy",
      message: "Is Buddy ready for pickup?"
    }),
    expect: all(expectIntent("pickup"), expectTask)
  },
  {
    name: "follow-up vaccine due",
    run: () => runInternalAgent({
      message: "Scan follow-up vaccine candidates."
    }),
    expect: all(expectIntent("followup"), expectTask)
  },
  {
    name: "invoice issue",
    run: () => runInternalAgent({
      message: "Run invoice audit for unusual charges."
    }),
    expect: all(expectIntent("invoice"), expectTask)
  },
  {
    name: "pricing review",
    run: () => runInternalAgent({
      message: "Check competitor prices and flag differences."
    }),
    expect: all(expectIntent("pricing"), expectTask)
  },
  {
    name: "call transcript to task",
    run: () => runExternalAgent({
      callerName: "Maya Parker",
      callerPhone: "(415) 555-0134",
      transcript: "Hi, I parked outside with Biscuit. Can you check us in?"
    }),
    expect: all(expectIntent("checkin"), expectTask)
  }
];

async function main() {
  const sandbox = await runInSandbox("VetAgent scenarios", async () => {
    const failures: string[] = [];
    for (const scenario of scenarios) {
      const result = await scenario.run();
      const failure = scenario.expect(result);
      const tools = result.toolCalls.map((tool) => tool.toolName).join(", ") || "none";
      console.log(`${failure ? "FAIL" : "PASS"} ${scenario.name}: ${result.message}`);
      console.log(`  intent: ${result.intent}; tools: ${tools}`);
      if (failure) failures.push(`${scenario.name}: ${failure}`);
    }
    return { failures };
  });

  if (sandbox.stdout) console.log(sandbox.stdout);
  if (sandbox.stderr) console.error(sandbox.stderr);
  const failures = sandbox.result?.failures ?? ["scenario runner failed"];
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
