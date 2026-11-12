import type { MetadataRoute } from "next";
import { publicEnv } from "@/shared/lib/env";
import { publicRoutes } from "@/shared/lib/site";

/** Solo las páginas públicas; el contenido de los grupos es privado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const { appUrl } = publicEnv();
  return publicRoutes.map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: "monthly",
    priority: path === "/login" ? 1 : 0.5,
  }));
}
