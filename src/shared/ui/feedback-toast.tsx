"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./feedback-toast.module.css";

export function FeedbackToast({
  message,
  isError,
}: {
  message: string;
  isError: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return createPortal(
    <div
      className={styles.toast}
      data-error={isError}
      role={isError ? "alert" : "status"}
    >
      <span>{message}</span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => setVisible(false)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
