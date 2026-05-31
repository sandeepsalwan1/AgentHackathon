const defaultClientRequestBaseUrl = "https://vetagent-internal.onrender.com/request";

export function clientRequestBaseUrl() {
  const raw = defaultClientRequestBaseUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export function clientRequestHost() {
  return clientRequestBaseUrl()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}
