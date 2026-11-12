export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Sugerencia de usuario a partir del correo (plan E2.F3.T2): la parte antes
 * de la @, sin acentos, en minúsculas, con `_` en lugar de puntos o guiones
 * y recortada a 24 caracteres. `null` si no queda un usuario válido.
 */
export function suggestUsername(email: string | null | undefined) {
  const local = email?.split("@")[0] ?? "";
  const candidate = local
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return USERNAME_PATTERN.test(candidate) ? candidate : null;
}
