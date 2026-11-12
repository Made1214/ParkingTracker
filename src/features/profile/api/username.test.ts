import { describe, expect, it } from "vitest";
import { normalizeUsername, suggestUsername } from "./username";

describe("suggestUsername", () => {
  it.each([
    ["ana.torres@example.com", "ana_torres"],
    ["Luis-Fernández@correo.pa", "luis_fernandez"],
    ["  sofi..g@x.com", "sofi_g"],
    ["muy.largo.nombre.de.usuario.extra@x.com", "muy_largo_nombre_de_usua"],
  ])("%s → %s", (email, expected) => {
    expect(suggestUsername(email)).toBe(expected);
  });

  it("devuelve null si no queda un usuario válido", () => {
    expect(suggestUsername("a@x.com")).toBeNull();
    expect(suggestUsername("...@x.com")).toBeNull();
    expect(suggestUsername(null)).toBeNull();
  });
});

it("normaliza a minúsculas sin espacios", () => {
  expect(normalizeUsername("  Ana_T ")).toBe("ana_t");
});
