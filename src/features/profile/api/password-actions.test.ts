import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  signIn: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<typeof import("../../auth/api/password-policy")>(
    "../../auth/api/password-policy",
  )),
  requireUser: mocks.requireUser,
}));
import { resetMemoryRateLimit } from "@/shared/lib/rate-limit";
import { changePassword } from "./password-actions";
import { TOO_MANY_PASSWORD_CHANGES } from "./password-limits";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
const valid = {
  current_password: "claveactual1",
  password: "clavenueva22",
  confirm_password: "clavenueva22",
};

beforeEach(() => {
  vi.resetAllMocks();
  resetMemoryRateLimit();
  mocks.requireUser.mockResolvedValue({
    supabase: {
      auth: {
        signInWithPassword: mocks.signIn,
        updateUser: mocks.update,
        signOut: mocks.signOut,
      },
    },
    user: { id: "user-1", email: "ana@example.com" },
  });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("changePassword", () => {
  it("cambia la contraseña tras comprobar la actual y cierra las demás sesiones", async () => {
    expect(await changePassword({}, form(valid))).toEqual({
      success: "Tu contraseña se actualizó.",
    });
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "claveactual1",
    });
    expect(mocks.update).toHaveBeenCalledWith({ password: "clavenueva22" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("no cambia nada si la contraseña actual es incorrecta", async () => {
    mocks.signIn.mockResolvedValue({ error: new Error("invalid") });
    expect((await changePassword({}, form(valid))).error).toBe(
      "La contraseña actual no es correcta.",
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("valida la nueva antes de preguntarle a Supabase", async () => {
    const cases: [Record<string, string>, RegExp][] = [
      [
        { ...valid, password: "corta1", confirm_password: "corta1" },
        /caracteres/,
      ],
      [{ ...valid, confirm_password: "otra-distinta1" }, /no coinciden/],
      [
        {
          ...valid,
          password: valid.current_password,
          confirm_password: valid.current_password,
        },
        /distinta de la actual/,
      ],
      [{ ...valid, current_password: "" }, /contraseña actual/],
    ];
    for (const [values, message] of cases)
      expect((await changePassword({}, form(values))).error).toMatch(message);
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("bloquea tras 5 intentos fallidos, antes de comprobar la contraseña", async () => {
    mocks.signIn.mockResolvedValue({ error: new Error("invalid") });
    for (let i = 0; i < 5; i++) await changePassword({}, form(valid));
    expect(await changePassword({}, form(valid))).toEqual({
      error: TOO_MANY_PASSWORD_CHANGES,
    });
    expect(mocks.signIn).toHaveBeenCalledTimes(5);
  });

  it("los cambios correctos no cuentan contra el límite", async () => {
    for (let i = 0; i < 8; i++)
      expect((await changePassword({}, form(valid))).success).toBeTruthy();
  });

  it("explica una contraseña que Supabase considera débil", async () => {
    mocks.update.mockResolvedValue({ error: { code: "weak_password" } });
    expect((await changePassword({}, form(valid))).error).toMatch(
      /no es segura/,
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("no falla si cerrar las demás sesiones falla", async () => {
    mocks.signOut.mockRejectedValue(new Error("network"));
    expect((await changePassword({}, form(valid))).success).toBeTruthy();
  });
});
