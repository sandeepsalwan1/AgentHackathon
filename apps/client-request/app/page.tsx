import { RequestForm, legacyRequestFormChrome } from "@central-vet/request-form";

export default function Page() {
  return <RequestForm chrome={legacyRequestFormChrome} />;
}
