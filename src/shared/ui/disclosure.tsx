import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** Sección desplegable con icono, título, pista y flecha animada. */
export function Disclosure({
  icon,
  title,
  hint,
  tone,
  compact,
  defaultOpen,
  className,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  tone?: "danger";
  compact?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      className={cn(
        "disclosure",
        tone === "danger" && "disclosure-danger",
        compact && "disclosure-compact",
        className,
      )}
      open={defaultOpen}
    >
      <summary>
        {icon && (
          <span className="disclosure-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="disclosure-text">
          <strong>{title}</strong>
          {hint && <small>{hint}</small>}
        </span>
        <ChevronDown
          className="disclosure-chevron"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
