import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function PickupPage() {
  return (
    <PublicAgentFlow
      title="Pickup Status"
      endpoint="/api/agent/pickup"
      intent="pickup"
      prompt="Pickup request"
      placeholder="Is Luna ready for pickup?"
      buttonLabel="Check Status"
    />
  );
}
