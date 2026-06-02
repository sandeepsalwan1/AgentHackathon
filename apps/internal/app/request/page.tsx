import { RequestForm, internalRequestFormChrome } from "@central-vet/request-form";

export default function RequestPage() {
  return <RequestForm chrome={internalRequestFormChrome} />;
}
