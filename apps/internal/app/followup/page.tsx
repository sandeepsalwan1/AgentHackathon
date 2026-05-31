import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function FollowupPage() {
  return (
    <PublicAgentFlow
      title="Follow-Up"
      endpoint="/api/agent/followup"
      intent="followup"
      prompt="Follow-up response"
      placeholder="Yes, I want to book the vaccine appointment."
      buttonLabel="Send Response"
    />
  );
}
