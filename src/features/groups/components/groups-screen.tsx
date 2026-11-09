import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarPlus,
  CheckSquare,
  Plus,
  Ticket,
  Wallet,
} from "lucide-react";
import { respond } from "@/features/rsvp";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ActionForm } from "@/shared/ui/action-form";
import {
  countdown,
  initials,
  longDate,
  panamaTime,
  shortDate,
} from "@/shared/lib/utils";
import { getDashboard } from "../api/dashboard";
import { createGroup, joinGroup } from "../api/actions";
import { RsvpBar } from "./rsvp-bar";
import styles from "./home.module.css";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const todoIcons = { poll: BarChart3, debt: Wallet, task: CheckSquare };

function money(cents: number) {
  return `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export async function GroupsScreen() {
  const data = await getDashboard();
  const name = data.displayName.split(" ")[0];
  const [next, ...rest] = data.upcoming;
  const headline =
    data.nextInMs !== null && data.nextInMs < WEEK_MS
      ? "Esta semana hay plan."
      : next
        ? "Ya hay plan a la vista."
        : "¿Qué se arma?";
  const firstDebt = data.todo.find((item) => item.kind === "debt");

  return (
    <>
      <header className={styles.header}>
        <span className="eyebrow">{longDate(data.now).toUpperCase()}</span>
        <h1>
          {name ? `Hola, ${name}. ` : ""}
          {headline}
        </h1>
      </header>

      <div className={styles.dashboard}>
        <div className={styles.main}>
          {next ? (
            <>
              <article className={styles.ticket}>
                <div className={styles.ticketMain}>
                  <span className={styles.ticketEyebrow}>
                    PRÓXIMA SALIDA
                    {next.groupName && (
                      <span className={styles.ticketTag}>{next.groupName}</span>
                    )}
                  </span>
                  <h2>
                    <Link href={`/groups/${next.groupId}/events/${next.id}`}>
                      {next.title}
                    </Link>
                  </h2>
                  <dl className={styles.ticketFacts}>
                    <div className={styles.wide}>
                      <dt>CUÁNDO</dt>
                      <dd>
                        {shortDate(next.startsAt)} · {panamaTime(next.startsAt)}{" "}
                        – {panamaTime(next.endsAt)}
                      </dd>
                    </div>
                    <div>
                      <dt>DÓNDE</dt>
                      <dd>{next.location || "Por confirmar"}</dd>
                    </div>
                    {next.organizer && (
                      <div>
                        <dt>ORGANIZA</dt>
                        <dd>{next.organizer}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className={styles.ticketStub}>
                  <div>
                    <span className={styles.ticketLabel}>FALTAN</span>
                    <strong className={styles.countdown}>
                      {countdown(data.nextInMs ?? 0)}
                    </strong>
                  </div>
                  <div>
                    {next.goingNames.length > 0 && (
                      <span className={styles.faces} aria-hidden="true">
                        {next.goingNames.slice(0, 3).map((person, index) => (
                          <span key={`${person}-${index}`}>
                            {initials(person)}
                          </span>
                        ))}
                        {next.goingNames.length > 3 && (
                          <span>+{next.goingNames.length - 3}</span>
                        )}
                      </span>
                    )}
                    <p>
                      {next.going} {next.going === 1 ? "va" : "van"} ·{" "}
                      {next.maybe} quizás
                    </p>
                    <Link
                      href={`/groups/${next.groupId}/events/${next.id}`}
                      className={styles.ticketLink}
                    >
                      Ver el plan <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
              <RsvpBar
                eventId={next.id}
                groupId={next.groupId}
                title={next.title}
                current={next.mine}
                respond={respond}
              />
            </>
          ) : (
            <Card className={styles.emptyNext}>
              <span className="tile-icon" aria-hidden="true">
                <CalendarPlus size={20} />
              </span>
              <div>
                <h2>Aún no hay salidas en el calendario</h2>
                <p className="muted small">
                  {data.groups.length
                    ? "Propón una fecha en tu grupo y el resto se suma."
                    : "Crea un grupo o únete con un código para empezar."}
                </p>
              </div>
            </Card>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="calendar-title">
              <div className={styles.sectionHead}>
                <h2 id="calendar-title">En el calendario</h2>
              </div>
              <div className={styles.calendar}>
                {rest.map((event) => (
                  <Link
                    key={event.id}
                    href={`/groups/${event.groupId}/events/${event.id}`}
                    className={styles.calendarCard}
                  >
                    <span className={styles.datePill}>
                      {shortDate(event.startsAt).toUpperCase()} ·{" "}
                      {panamaTime(event.startsAt)}
                    </span>
                    <h3>{event.title}</h3>
                    <p className="small muted">
                      {[event.location, event.groupName]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {event.mine
                        ? `${event.going} ${event.going === 1 ? "va" : "van"}, ${event.maybe} quizás`
                        : "falta tu respuesta"}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className={styles.side}>
          <Card className={styles.todo}>
            <span className="eyebrow">
              TE TOCA
              <span className={styles.todoCount}>{data.todo.length}</span>
            </span>
            {data.todo.length ? (
              <ul>
                {data.todo.slice(0, 5).map((item) => {
                  const Icon = todoIcons[item.kind];
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link href={item.href}>
                        <span
                          className={styles.todoIcon}
                          data-kind={item.kind}
                          aria-hidden="true"
                        >
                          <Icon size={18} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="small muted">
                Nada pendiente por ahora. Tus votos, tareas y deudas aparecerán
                aquí.
              </p>
            )}
          </Card>

          <div className={styles.balance}>
            <span className="eyebrow">TU SALDO EN TUS GRUPOS</span>
            <strong>{money(data.balanceCents)}</strong>
            <p className="small">
              {data.balanceCents < 0
                ? "Tienes pagos pendientes con tu gente."
                : data.balanceCents > 0
                  ? "Te deben dinero de gastos compartidos."
                  : "Estás a mano con todo el mundo."}
            </p>
            {firstDebt && (
              <Link href={firstDebt.href} className="button">
                Ver cómo quedar a mano
              </Link>
            )}
          </div>

          <Card className={styles.groups} id="mis-grupos">
            <span className="eyebrow">
              MIS GRUPOS
              <span className="count">{data.groups.length}</span>
            </span>
            {data.groups.length ? (
              <ul>
                {data.groups.map((group) => (
                  <li key={group.id}>
                    <Link href={`/groups/${group.id}`}>
                      <span className={styles.groupBadge} aria-hidden="true">
                        {group.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>{group.name}</span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Aquí irá tu próxima gran historia.</p>
            )}
          </Card>
        </aside>
      </div>

      <div className={`two-column ${styles.setup}`} id="crear-grupo">
        <Card>
          <span className="tile-icon">
            <Plus size={20} />
          </span>
          <h2>Reúne a tu gente</h2>
          <p className="muted">
            Crea un espacio privado para los planes de siempre y los que aún no
            imaginan.
          </p>
          <ActionForm action={createGroup} label="Crear grupo">
            <label>
              Nombre del grupo
              <Input
                name="name"
                required
                maxLength={80}
                placeholder="Los de siempre"
              />
            </label>
          </ActionForm>
          <p className="small muted">
            Después puedes añadir una descripción e imagen en los ajustes del
            grupo.
          </p>
        </Card>
        <Card>
          <span className="tile-icon peach">
            <Ticket size={20} />
          </span>
          <h2>¿Ya tienes invitación?</h2>
          <p className="muted">
            Tu grupo te está esperando. Introduce el código y súmate al próximo
            plan.
          </p>
          <ActionForm action={joinGroup} label="Unirme al grupo">
            <label>
              Código de invitación
              <Input
                name="code"
                required
                minLength={8}
                maxLength={8}
                pattern="[A-Za-z0-9]{8}"
                placeholder="ABCD1234"
                autoCapitalize="characters"
              />
            </label>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
