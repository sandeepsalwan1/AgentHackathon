import { PublicAgentFlow } from "../components/PublicAgentFlow";

export default function BookingPage() {
  return (
    <PublicAgentFlow
      title="Book Appointment"
      endpoint="/api/agent/booking"
      intent="booking"
      prompt="Booking request"
      placeholder="Can I book vaccines next week after 3?"
      buttonLabel="Find Slots"
    />
  );
}
