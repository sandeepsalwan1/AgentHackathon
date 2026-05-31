const defaultClientRequestBaseUrl = "https://vetagent-client.onrender.com";

export function clientRequestBaseUrl() {
  const raw =
    process.env.CLIENT_REQUEST_BASE_URL ||
    process.env.NEXT_PUBLIC_CLIENT_REQUEST_BASE_URL ||
    defaultClientRequestBaseUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export function clientRequestHost() {
  return clientRequestBaseUrl()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}
