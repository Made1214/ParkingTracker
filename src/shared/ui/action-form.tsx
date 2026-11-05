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
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "form-stack"}>
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
      <Button disabled={pending || disabled} type="submit">
        {pending ? "Guardando…" : label}
      </Button>
    </form>
  );
}
