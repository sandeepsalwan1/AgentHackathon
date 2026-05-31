import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const seoHost = "central-vet-request.vercel.app";

export function GET(request: NextRequest) {
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
