import { Suspense } from "react";
import Link from "next/link";
import { AlignLeft, ArrowLeft, Clock3, MapPin, PencilLine } from "lucide-react";
import { AttendancePanel } from "@/features/rsvp";
import {
  PollComposer,
  ProposalsPanel,
  PollsPanel,
  getLivePoll,
} from "@/features/proposals";
import { TasksPanel, getTaskProgress } from "@/features/tasks";
import { SchedulePanel } from "@/features/schedule";
import { CommentsPanel } from "@/features/comments";
import { GalleryPanel } from "@/features/gallery";
import {
  ExpensesPanel,
  formatMoney,
  getExpenseSummary,
} from "@/features/expenses";
import { Card } from "@/shared/ui/card";
import { Motion } from "@/shared/ui/motion";
import { panamaTime, shortDate } from "@/shared/lib/utils";
import { getEvent } from "../api/queries";
import { statusLabels } from "./event-list";
import { ManageEvent } from "./manage-event";
import { EventCover } from "./event-cover";
import styles from "./event-screen.module.css";

const sections = [
  { value: "plan", label: "Plan" },
  { value: "votaciones", label: "Votos" },
  { value: "gastos", label: "Gastos" },
  { value: "tareas", label: "Tareas" },
  { value: "fotos", label: "Fotos" },
] as const;

export async function EventScreen({
  groupId,
  eventId,
  section,
}: {
  groupId: string;
  eventId: string;
  section?: string | string[];
}) {
  const [{ event, organizer, user, canRespond, canManage }, live] =
    await Promise.all([
      getEvent(groupId, eventId),
      getLivePoll(groupId, eventId),
    ]);
  const active =
    sections.find((item) => item.value === section)?.value ?? "plan";
  const eventUrl = `/groups/${groupId}/events/${eventId}`;
  const open = event.status === "published";
  const sameDay = shortDate(event.starts_at) === shortDate(event.ends_at);

  return (
    <>
      {event.cover_public_id && (
        <EventCover
          key={event.updated_at}
          groupId={groupId}
          eventId={eventId}
          revision={event.updated_at}
        />
      )}
      <header className={styles.hero}>
        <Link className={styles.back} href={`/groups/${groupId}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver al grupo
        </Link>
        <p className={styles.eyebrow}>
          {open && <span className="status-beacon" aria-hidden="true" />}
          {statusLabels[event.status].toUpperCase()}
          {organizer && ` · ORGANIZA ${organizer.toUpperCase()}`}
        </p>
        <h1>{event.title}</h1>
        <div className={styles.heroFoot}>
          <ul className={styles.meta}>
            <li>
              <Clock3 size={18} aria-hidden="true" />
              {shortDate(event.starts_at)} · {panamaTime(event.starts_at)} –{" "}
              {sameDay
                ? panamaTime(event.ends_at)
                : `${shortDate(event.ends_at)} ${panamaTime(event.ends_at)}`}
              <span className={styles.tz}>hora de Panamá</span>
            </li>
            <li>
              <MapPin size={18} aria-hidden="true" />
              {event.location || "Lugar por confirmar"}
            </li>
          </ul>
          {canManage && (
            <a href="#gestionar" className={styles.heroAction}>
              <PencilLine size={16} aria-hidden="true" /> Editar o cancelar
            </a>
          )}
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Secciones de la salida">
        {sections.map(({ value, label }) => (
          <Link
            key={value}
            href={value === "plan" ? eventUrl : `${eventUrl}?section=${value}`}
            aria-current={active === value ? "page" : undefined}
          >
            {label}
            {value === "votaciones" && live.openCount > 0 && (
              <span className={styles.tabCount}>{live.openCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {active === "plan" && (
        <>
          <div className={styles.planGrid}>
            <div className={styles.planMain}>
              <Suspense fallback={<PanelSkeleton label="cronograma" />}>
                <SchedulePanel groupId={groupId} eventId={eventId} />
              </Suspense>
              {event.description && (
                <Card className={styles.notes}>
                  <h2>
                    <AlignLeft size={16} aria-hidden="true" /> Notas del plan
                  </h2>
                  <p>{event.description}</p>
                </Card>
              )}
              <Suspense fallback={<PanelSkeleton label="comentarios" />}>
                <CommentsPanel groupId={groupId} eventId={eventId} />
              </Suspense>
              {canManage && (
                <div id="gestionar" className={styles.manage}>
                  <ManageEvent event={event} />
                </div>
              )}
            </div>
            <aside className={styles.planSide}>
              <AttendancePanel
                groupId={groupId}
                eventId={eventId}
                userId={user.id}
                open={canRespond}
              />
              {live.poll && (
                <Motion>
                  <Link
                    href={`${eventUrl}?section=votaciones`}
                    className={styles.livePoll}
                  >
                    <span className={styles.liveLabel}>
                      <span className="status-beacon" aria-hidden="true" />
                      VOTACIÓN EN VIVO
                    </span>
                    <h2>{live.poll.question}</h2>
                    <ul>
                      {live.poll.options.slice(0, 3).map((option) => (
                        <li key={option.id}>
                          <span>
                            {option.label}
                            <strong data-count>{option.percent}%</strong>
                          </span>
                          <span className={styles.bar} aria-hidden="true">
                            <span
                              data-grow="x"
                              style={{ width: `${option.percent}%` }}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                </Motion>
              )}
              <Suspense fallback={null}>
                <PlanStats groupId={groupId} eventId={eventId} />
              </Suspense>
            </aside>
          </div>
        </>
      )}
      {active === "votaciones" && (
        <div className={styles.panels}>
          <Suspense fallback={<PanelSkeleton label="votaciones" />}>
            <PollsPanel groupId={groupId} eventId={eventId} open={open} />
          </Suspense>
          <div className={styles.side}>
            {open && (
              <PollComposer groupId={groupId} eventId={eventId} standalone />
            )}
            <Suspense fallback={<PanelSkeleton label="propuestas" />}>
              <ProposalsPanel groupId={groupId} eventId={eventId} open={open} />
            </Suspense>
          </div>
        </div>
      )}
      {active === "gastos" && (
        <Suspense fallback={<PanelSkeleton label="gastos" />}>
          <ExpensesPanel groupId={groupId} eventId={eventId} />
        </Suspense>
      )}
      {active === "fotos" && (
        <Suspense fallback={<PanelSkeleton label="fotos" />}>
          <GalleryPanel groupId={groupId} eventId={eventId} />
        </Suspense>
      )}
      {active === "tareas" && (
        <Suspense fallback={<PanelSkeleton label="tareas" />}>
          <TasksPanel groupId={groupId} eventId={eventId} readOnly={!open} />
        </Suspense>
      )}
    </>
  );
}

async function PlanStats({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const [tasks, expenses] = await Promise.all([
    getTaskProgress(groupId, eventId),
    getExpenseSummary(groupId, eventId),
  ]);
  const eventUrl = `/groups/${groupId}/events/${eventId}`;
  return (
    <Motion>
      <div className={styles.stats}>
        <Link href={`${eventUrl}?section=tareas`} className={styles.stat}>
          <span className="eyebrow">TAREAS</span>
          <strong data-count="first">
            {tasks.done}/{tasks.total}
          </strong>
          <span className={styles.bar} aria-hidden="true">
            <span
              data-grow="x"
              style={{
                width: `${tasks.total ? (tasks.done / tasks.total) * 100 : 0}%`,
              }}
            />
          </span>
        </Link>
        <Link href={`${eventUrl}?section=gastos`} className={styles.stat}>
          <span className="eyebrow">GASTOS</span>
          <strong data-count>{formatMoney(expenses.totalCents)}</strong>
          <span className="small muted">
            {expenses.count
              ? `${formatMoney(expenses.perPersonCents)} por persona`
              : "Sin gastos aún"}
          </span>
        </Link>
      </div>
    </Motion>
  );
}

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div
      className={styles.skeleton}
      role="status"
      aria-label={`Cargando ${label}`}
    >
      <span className="sr-only">Cargando {label}...</span>
      <div aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
