import type { NextRequest } from "next/server";
import { clientRequestHost } from "../siteConfig";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const seoHost = clientRequestHost();
  const host = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(":")[0]
    .toLowerCase();
  const isSeoHost = host === seoHost;
  const body = isSeoHost
    ? `User-agent: *
Allow: /
Sitemap: https://${seoHost}/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
