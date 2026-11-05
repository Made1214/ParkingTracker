"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import styles from "./theme-select.module.css";

const subscribe = () => () => {};

export function ThemeSelect() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  return (
    <label className={styles.control}>
      <span>Tema</span>
      <select
        aria-label="Tema de apariencia"
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
