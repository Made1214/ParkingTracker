import type { MetadataRoute } from "next";
import { publicEnv } from "@/shared/lib/env";
import { publicRoutes } from "@/shared/lib/site";

export default function robots(): MetadataRoute.Robots {
  const { appUrl } = publicEnv();
  return {
    rules: {
      userAgent: "*",
      allow: publicRoutes,
      // Contenido privado de los grupos: nunca se indexa.
      disallow: ["/groups", "/profile", "/join", "/api", "/auth"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
