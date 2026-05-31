import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function RecordsPage() {
  return (
    <PublicAgentFlow
      title="Records Transfer"
      endpoint="/api/agent/records"
      intent="records"
      prompt="Records request"
      placeholder="Please send Maple's vaccine records to Bayview Animal Clinic."
      buttonLabel="Request Records"
      destination
    />
  );
}
