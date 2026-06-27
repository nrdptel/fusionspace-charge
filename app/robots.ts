import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Same origin the metadata/OG and sitemap resolve against; a fork can point all
// three at its own domain with NEXT_PUBLIC_SITE_URL. Mirrors the Motor Finder.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://charge.fusionspace.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
