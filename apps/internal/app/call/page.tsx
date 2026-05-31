import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function CallPage() {
  return (
    <PublicAgentFlow
      title="Call Intake"
      endpoint="/api/agent/call"
      intent="call"
      prompt="Call transcript"
      placeholder="Hi, this is Maya. I am outside for Biscuit's appointment and wanted to check in."
      buttonLabel="Create Task"
      transcript
    />
  );
}
