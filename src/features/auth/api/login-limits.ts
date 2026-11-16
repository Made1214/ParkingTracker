// Freno a la fuerza bruta (issue #54): solo cuentan los intentos fallidos, así
// que quien acierta nunca queda bloqueado. Por correo es estricto; por IP es
// más holgado para no castigar a una oficina que comparte salida a internet.
export const FAILED_PER_EMAIL = { scope: "login-fail-email", limit: 5 };
export const FAILED_PER_IP = { scope: "login-fail-ip", limit: 20 };
export const TOO_MANY_LOGINS =
  "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
