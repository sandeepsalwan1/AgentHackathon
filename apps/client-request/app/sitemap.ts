import type { MetadataRoute } from "next";
import { clientRequestBaseUrl } from "./siteConfig";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${clientRequestBaseUrl()}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7
    }
  ];
}
