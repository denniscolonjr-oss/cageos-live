import type { MetadataRoute } from "next";

/**
 * Generates /robots.txt at request time.
 *
 * Strategy: open up the marketing/landing routes to indexing, but block
 * authenticated/app routes (dashboard, kiosk, settings, asset detail, etc.)
 * because they require auth and shouldn't be crawled. Indexing those would
 * either show login screens in search results (bad) or surface real
 * workspace data if Google somehow followed a redirect (very bad).
 *
 * The sitemap reference points crawlers at /sitemap.xml which lists the
 * canonical public URLs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/asset/",
          "/kit/",
          "/kiosk",
          "/kiosk/",
          "/checkout/",
          "/settings",
          "/settings/",
          "/login",
          "/signup",
          "/profile/",
          "/invite/",
          "/api/",
        ],
      },
    ],
    sitemap: "https://cageos.app/sitemap.xml",
    host: "https://cageos.app",
  };
}
