import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/shared/lib/env", () => ({
  publicEnv: () => ({ url: "", key: "", appUrl: "https://parking.example" }),
}));
import robots from "./robots";
import sitemap from "./sitemap";
import { contactEmail, publicRoutes } from "@/shared/lib/site";

describe("robots", () => {
  it("permite solo las páginas públicas y bloquea el contenido de los grupos", () => {
    const { rules, sitemap: map } = robots();
    expect(rules).toMatchObject({ allow: publicRoutes });
    expect((rules as { disallow: string[] }).disallow).toEqual(
      expect.arrayContaining(["/groups", "/profile", "/join", "/api"]),
    );
    expect(map).toBe("https://parking.example/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("lista solo rutas públicas con URL absoluta", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://parking.example/login",
      "https://parking.example/register",
      "https://parking.example/privacy",
      "https://parking.example/terms",
    ]);
  });
});

describe("contactEmail", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("solo devuelve un correo válido", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", " hola@parking.example ");
    expect(contactEmail()).toBe("hola@parking.example");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "no-es-correo");
    expect(contactEmail()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "");
    expect(contactEmail()).toBeNull();
  });
});
