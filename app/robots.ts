import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api",
        "/ai",
        "/super-admin",
        "/projects",
        "/team",
        "/vacations",
        "/onboarding",
      ],
    },
    sitemap: "https://cloudtimer.dk/sitemap.xml",
  };
}
