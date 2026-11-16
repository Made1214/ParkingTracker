"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import styles from "./password-input.module.css";

/**
 * Campo de contraseña con un botón para verla antes de enviar (issue #53).
 *
 * Es el `Input` de siempre: conserva `autoComplete`, `minLength`, `maxLength` y
 * `aria-describedby`, así que los gestores de contraseñas siguen funcionando.
 * Al enviar el formulario vuelve a ocultarse, para que el navegador no guarde
 * el campo como texto.
 */
export function PasswordInput(
  props: Omit<ComponentProps<typeof Input>, "type">,
) {
  const [visible, setVisible] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = field.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <span className={styles.wrap}>
      <Input
        {...props}
        ref={field}
        type={visible ? "text" : "password"}
        className={styles.input}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
