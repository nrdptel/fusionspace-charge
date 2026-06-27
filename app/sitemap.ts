import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Resolved against NEXT_PUBLIC_SITE_URL so a fork's sitemap points at its own
// domain, consistent with robots.ts, the metadata, and the Motor Finder.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://charge.fusionspace.co";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
