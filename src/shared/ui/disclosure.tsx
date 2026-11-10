"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import gsap from "gsap";
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
  const details = useRef<HTMLDetailsElement>(null);
  const clip = useRef<HTMLDivElement>(null);

  // <details> abre y cierra de golpe; aquí la altura acompaña el cambio.
  // Con "reducir movimiento" se deja el comportamiento nativo.
  function toggle(event: MouseEvent) {
    const element = details.current;
    const body = clip.current;
    if (
      !element ||
      !body ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    event.preventDefault();
    gsap.killTweensOf(body);
    const closing = element.open && !element.hasAttribute("data-closing");
    if (closing) {
      element.setAttribute("data-closing", "");
      gsap.to(body, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: "power2.inOut",
        onComplete: () => {
          element.open = false;
          element.removeAttribute("data-closing");
          gsap.set(body, { clearProps: "height,opacity" });
        },
      });
      return;
    }
    const reopening = element.open;
    element.removeAttribute("data-closing");
    element.open = true;
    if (!reopening) gsap.set(body, { height: 0, opacity: 0 });
    gsap.to(body, {
      height: "auto",
      opacity: 1,
      duration: 0.36,
      ease: "power3.out",
      clearProps: "height,opacity",
    });
  }

  return (
    <details
      ref={details}
      className={cn(
        "disclosure",
        tone === "danger" && "disclosure-danger",
        compact && "disclosure-compact",
        className,
      )}
      open={defaultOpen}
    >
      <summary onClick={toggle}>
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
      <div ref={clip} className="disclosure-clip">
        <div className="disclosure-body">{children}</div>
      </div>
    </details>
  );
}
