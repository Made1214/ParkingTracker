// Freno a quien adivina la contraseña actual desde una sesión robada (issue #54):
// solo cuentan los intentos fallidos de cada persona.
export const FAILED_PASSWORD_CHANGES = {
  scope: "password-change-fail",
  limit: 5,
};
export const TOO_MANY_PASSWORD_CHANGES =
  "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
