import {
  ArrowRight,
  BedDouble,
  Car,
  EllipsisVertical,
  Receipt,
  ShoppingBag,
  Ticket,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { initials } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { deleteExpense, settleDebt } from "../api/actions";
import { categories, formatMoney } from "../api/expense-form";
import { getExpenses } from "../api/queries";
import { ExpenseForm } from "./expense-form";
import styles from "./expenses.module.css";

const categoryIcons: Record<string, LucideIcon> = {
  comida: Utensils,
  transporte: Car,
  alojamiento: BedDouble,
  entradas: Ticket,
  compras: ShoppingBag,
  otro: Receipt,
};

export async function ExpensesPanel({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const data = await getExpenses(groupId, eventId);
  const maxBalance = Math.max(
    1,
    ...data.balances.map((b) => Math.abs(b.cents)),
  );
  const hidden = (
    <>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
    </>
  );
  const myLine =
    data.myBalanceCents < 0
      ? `Debes ${formatMoney(-data.myBalanceCents)}`
      : data.myBalanceCents > 0
        ? `Te deben ${formatMoney(data.myBalanceCents)}`
        : "Estás a mano";

  return (
    <div className={styles.layout}>
      <div className={styles.kpis}>
        <div className={styles.balanceCard}>
          <span className="eyebrow">TU SALDO</span>
          <strong>{formatMoney(data.myBalanceCents)}</strong>
          <span>{myLine}</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">GASTO TOTAL</span>
          <strong>{formatMoney(data.totalCents)}</strong>
          <span className="small muted">
            {data.expenses.length}{" "}
            {data.expenses.length === 1 ? "gasto" : "gastos"}
          </span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">POR PERSONA</span>
          <strong>{formatMoney(data.perPersonCents)}</strong>
          <span className="small muted">promedio entre quienes participan</span>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Card>
            <h2>Para quedar a mano</h2>
            <p className="small muted">
              Deudas pendientes por pareja, ya compensadas entre sí.
            </p>
            {data.debts.length ? (
              <ul className={styles.debts}>
                {data.debts.map((debt) => (
                  <li
                    key={`${debt.debtor}-${debt.creditor}`}
                    className={debt.mine ? styles.debtMine : styles.debt}
                  >
                    <span className={styles.debtPeople}>
                      <span className={styles.face} aria-hidden="true">
                        {initials(debt.debtorName)}
                      </span>
                      {debt.debtorName}
                      <ArrowRight size={16} aria-label="le debe a" />
                      <span className={styles.face} aria-hidden="true">
                        {initials(debt.creditorName)}
                      </span>
                      {debt.creditorName}
                    </span>
                    <strong>{formatMoney(debt.cents)}</strong>
                    {debt.canSettle && (
                      <ActionForm
                        action={settleDebt}
                        label={debt.mine ? "Ya pagué" : "Marcar saldado"}
                        tone={debt.mine ? undefined : "outline"}
                        className={styles.settle}
                      >
                        {hidden}
                        <input
                          type="hidden"
                          name="debtor"
                          value={debt.debtor}
                        />
                        <input
                          type="hidden"
                          name="creditor"
                          value={debt.creditor}
                        />
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="message success">
                {data.expenses.length
                  ? "Todo el mundo está a mano."
                  : "Aún no hay gastos registrados."}
              </p>
            )}
          </Card>

          {data.balances.length > 0 && (
            <Card>
              <h2>Balance por persona</h2>
              <div className={styles.legend} aria-hidden="true">
                <span>Debe</span>
                <span>Le deben</span>
              </div>
              <ul className={styles.bars}>
                {data.balances.map((balance) => {
                  const width = `${Math.round((Math.abs(balance.cents) / maxBalance) * 100)}%`;
                  return (
                    <li key={balance.id}>
                      <span className={styles.barName}>{balance.name}</span>
                      <span className={styles.barTrack} aria-hidden="true">
                        <span className={styles.barNeg}>
                          {balance.cents < 0 && <span style={{ width }} />}
                        </span>
                        <span className={styles.barPos}>
                          {balance.cents > 0 && <span style={{ width }} />}
                        </span>
                      </span>
                      <span
                        className={
                          balance.cents > 0
                            ? styles.amountPos
                            : styles.amountNeg
                        }
                      >
                        {balance.cents > 0 ? "+" : ""}
                        {formatMoney(balance.cents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <Card>
            <div className={styles.cardTitle}>
              <h2 id="expenses-list">Gastos registrados</h2>
              <span className="count">{data.expenses.length}</span>
            </div>
            {data.expenses.length ? (
              <ul className={styles.list}>
                {data.expenses.map((expense) => {
                  const Icon = categoryIcons[expense.category] ?? Receipt;
                  return (
                    <li key={expense.id}>
                      <span
                        className={styles.categoryIcon}
                        data-category={expense.category}
                        aria-hidden="true"
                      >
                        <Icon size={18} />
                      </span>
                      <span className={styles.listMain}>
                        <strong>{expense.description}</strong>
                        <span className="small muted">
                          Pagó {expense.payer} ·{" "}
                          {categories.find((c) => c.value === expense.category)
                            ?.label ?? "Otro"}{" "}
                          · entre {expense.people}
                        </span>
                      </span>
                      <span className={styles.listAmount}>
                        {formatMoney(expense.cents)}
                      </span>
                      {expense.canDelete && (
                        <details className={styles.remove}>
                          <summary
                            aria-label={`Opciones de ${expense.description}`}
                          >
                            <EllipsisVertical size={18} aria-hidden="true" />
                          </summary>
                          <ActionForm
                            action={deleteExpense}
                            label="Eliminar gasto"
                            tone="danger"
                            className={styles.removeForm}
                          >
                            {hidden}
                            <input type="hidden" name="id" value={expense.id} />
                          </ActionForm>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small muted">
                Todavía no hay gastos. Registra el primero y la app reparte por
                ti.
              </p>
            )}
          </Card>
        </div>

        <div className={styles.side}>
          {data.open && (
            <Card>
              <div className={styles.cardHeading}>
                <span className="tile-icon" aria-hidden="true">
                  <Wallet size={20} />
                </span>
                <h2>Registrar gasto</h2>
              </div>
              <ExpenseForm
                groupId={groupId}
                eventId={eventId}
                userId={data.userId}
                members={data.members}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
