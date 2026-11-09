"use client";
import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/shared/lib/forms";
import { Button } from "./button";
export function ActionForm({
  action,
  children,
  label,
  className,
  disabled,
  hideSubmit,
  secondary,
  tone,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
  hideSubmit?: boolean;
  secondary?: ReactNode;
  /** Estilo del botón: "danger" para acciones destructivas. */
  tone?: "outline" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className ?? "form-stack"}
      aria-busy={pending}
    >
      {children}
      {state.error && (
        <p role="alert" className="message error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="message success">
          {state.success}
        </p>
      )}
      {!hideSubmit && (
        <Button
          disabled={pending || disabled}
          type="submit"
          variant={tone}
          aria-busy={pending || undefined}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" /> Guardando…
            </>
          ) : (
            label
          )}
        </Button>
      )}
      {secondary}
    </form>
  );
}
