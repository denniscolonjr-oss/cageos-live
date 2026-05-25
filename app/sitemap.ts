import type { MetadataRoute } from "next";

/**
 * Generates /sitemap.xml at request time.
 *
 * For now we have only one public marketing page (the landing at `/`) plus
 * legal pages. As we add more public content (blog posts, case studies,
 * vertical-specific landing pages), they get appended to this array.
 *
 * Dashboard/auth routes are intentionally excluded (also blocked in
 * robots.ts). Sitemap is for crawlers to discover indexable content.
 *
 * The `lastModified` value uses build time so it doesn't lie about freshness.
 * `changeFrequency` and `priority` are hints to crawlers — they may ignore
 * them but it costs nothing to provide.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cageos.app";
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
