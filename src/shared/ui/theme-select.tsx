"use client";

import { useId, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import styles from "./theme-select.module.css";

const subscribe = () => () => {};
const choices = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
] as const;

// Mantiene los radios independientes cuando hay dos selectores en pantalla.
export function ThemeSelect() {
  const name = useId();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className={styles.control} disabled={!mounted}>
      <legend className="sr-only">Tema de apariencia</legend>
      {choices.map(({ value, label, Icon }) => (
        <label key={value} className={styles.option} title={label}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={(mounted ? (theme ?? "system") : "system") === value}
            onChange={() => setTheme(value)}
          />
          <span>
            <Icon size={16} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
