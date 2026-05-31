import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function ArrivalPage() {
  return (
    <PublicAgentFlow
      title="Arrival Check-In"
      endpoint="/api/agent/checkin"
      intent="checkin"
      prompt="Arrival message"
      placeholder="I'm outside for Biscuit's appointment and want to check in."
      buttonLabel="Check In"
    />
  );
}
