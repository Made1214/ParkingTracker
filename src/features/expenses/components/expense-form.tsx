"use client";

import { useRef, useState } from "react";
import type { ActionState } from "@/shared/lib/forms";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { createExpense, editExpense } from "../api/actions";
import {
  categories,
  equalShares,
  formatMoney,
  toCents,
} from "../api/expense-form";
import { initials } from "@/shared/lib/utils";
import styles from "./expenses.module.css";

// Prepara el reparto y conserva la clave de cada intento de guardado.
export function ExpenseForm({
  groupId,
  eventId,
  userId,
  members,
  expense,
}: {
  groupId: string;
  eventId: string;
  userId: string;
  members: { id: string; name: string }[];
  expense?: {
    id: string;
    description: string;
    cents: number;
    category: string;
    paidBy: string;
    shares: { userId: string; cents: number }[];
  };
}) {
  const [amount, setAmount] = useState(
    expense ? (expense.cents / 100).toFixed(2) : "",
  );
  const [mode, setMode] = useState<"equal" | "custom">(
    expense ? "custom" : "equal",
  );
  const [selected, setSelected] = useState(
    () => expense?.shares.map((s) => s.userId) ?? members.map((m) => m.id),
  );
  const [payer, setPayer] = useState(expense?.paidBy ?? userId);
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      expense?.shares.map((s) => [s.userId, (s.cents / 100).toFixed(2)]) ?? [],
    ),
  );
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  // Genera la clave al enviar y la reutiliza si se reintenta el mismo gasto.
  async function submit(state: ActionState, form: FormData) {
    if (expense) {
      form.set("expense_id", expense.id);
      return editExpense(state, form);
    }
    const payload = JSON.stringify([...form.entries()]);
    if (attempt.current?.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    form.set("idempotency_key", attempt.current.key);
    const result = await createExpense(state, form);
    if (result.success) attempt.current = null;
    return result;
  }

  const total = toCents(amount) ?? 0;
  const preview = new Map(
    selected.length && total
      ? equalShares(total, selected, payer).map((s) => [s.userId, s.cents])
      : [],
  );
  const customSum = selected.reduce(
    (sum, id) => sum + (toCents(custom[id] ?? "") ?? 0),
    0,
  );

  return (
    <ActionForm
      action={submit}
      label={expense ? "Guardar cambios" : "Guardar gasto"}
    >
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="split" value={mode} />
      <div className={styles.row}>
        <label className={styles.grow}>
          Descripción
          <Input
            name="description"
            defaultValue={expense?.description}
            required
            maxLength={200}
            placeholder="Ej. Hielo y carbón"
          />
        </label>
        <label className={styles.amount}>
          Monto (USD)
          <Input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.row}>
        <label className={styles.grow}>
          Pagó
          <select
            className="input"
            name="paid_by"
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.grow}>
          Categoría
          <select
            className="input"
            name="category"
            defaultValue={expense?.category ?? "comida"}
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Cómo se divide</legend>
        <div className={styles.segmented} role="radiogroup">
          {(
            [
              ["equal", "Partes iguales"],
              ["custom", "Personalizado"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className={styles.people}>
          {members.map((member) => {
            const checked = selected.includes(member.id);
            return (
              <li key={member.id}>
                <label className={styles.person}>
                  <input
                    type="checkbox"
                    name="participants"
                    value={member.id}
                    checked={checked}
                    onChange={() =>
                      setSelected((current) =>
                        checked
                          ? current.filter((id) => id !== member.id)
                          : [...current, member.id],
                      )
                    }
                  />
                  <span className={styles.personFace} aria-hidden="true">
                    {initials(member.name)}
                  </span>
                  <span>{member.name}</span>
                </label>
                {checked && mode === "equal" && (
                  <span className={styles.share}>
                    {formatMoney(preview.get(member.id) ?? 0)}
                  </span>
                )}
                {checked && mode === "custom" && (
                  <Input
                    aria-label={`Monto de ${member.name}`}
                    className={styles.shareInput}
                    name={`share_${member.id}`}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={custom[member.id] ?? ""}
                    onChange={(event) =>
                      setCustom((current) => ({
                        ...current,
                        [member.id]: event.target.value,
                      }))
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
        <p className="small muted" aria-live="polite">
          {mode === "equal"
            ? selected.length
              ? `${formatMoney(total)} entre ${selected.length}.`
              : "Elige al menos una persona."
            : `Asignado ${formatMoney(customSum)} de ${formatMoney(total)}${
                customSum === total && total ? " ✓" : ""
              }`}
        </p>
      </fieldset>
    </ActionForm>
  );
}
