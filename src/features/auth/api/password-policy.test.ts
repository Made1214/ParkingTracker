import { describe, expect, it } from "vitest";
import { isWeakPasswordError, passwordProblem } from "./password-policy";

describe("passwordProblem", () => {
  it("acepta 10 o más caracteres con letras y números", () => {
    expect(passwordProblem("planazo2026")).toBeNull();
    expect(passwordProblem("Ñandú y 10 amigos")).toBeNull();
  });

  it.each([
    ["corta1", "A tu contraseña le falta al menos 10 caracteres."],
    ["soloLetrasLargas", "A tu contraseña le falta un número."],
    ["1234567890", "A tu contraseña le falta una letra."],
    ["abc", "A tu contraseña le falta al menos 10 caracteres y un número."],
    [
      "",
      "A tu contraseña le falta al menos 10 caracteres, una letra y un número.",
    ],
  ])("%s → %s", (password, message) => {
    expect(passwordProblem(password)).toBe(message);
  });

  it("limita el largo máximo", () => {
    expect(passwordProblem("a1".repeat(65))).toBe(
      "La contraseña admite hasta 128 caracteres.",
    );
  });
});

it("reconoce el error de contraseña débil de Supabase", () => {
  expect(isWeakPasswordError({ code: "weak_password" })).toBe(true);
  expect(isWeakPasswordError({ code: "over_request_rate_limit" })).toBe(false);
  expect(isWeakPasswordError(null)).toBe(false);
});
