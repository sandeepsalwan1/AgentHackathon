import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { clientRequestBaseUrl, clientRequestHost } from "./siteConfig";
import "./globals.css";

const icons: Metadata["icons"] = {
  icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  shortcut: "/icon.svg"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export async function generateMetadata(): Promise<Metadata> {
  const seoHost = clientRequestHost();
  const headerStore = await headers();
  const host = (
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    ""
  )
    .split(":")[0]
    .toLowerCase();
  const isSeoHost = host === seoHost;

  if (!isSeoHost) {
    return {
      title: "Client Request",
      robots: { index: false, follow: false },
      icons
    };
  }

  const description =
    "Submit a client request to Central Veterinary Hospital for clinic follow-up.";

  return {
    metadataBase: new URL(clientRequestBaseUrl()),
    title: "Central Veterinary Hospital Client Request",
    description,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: {
      title: "Central Veterinary Hospital Client Request",
      description,
      url: "/",
      siteName: "Central Veterinary Hospital",
      type: "website"
    },
    icons
  };
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
