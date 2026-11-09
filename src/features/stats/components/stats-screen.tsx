import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { formatMoney } from "@/features/expenses";
import { Card } from "@/shared/ui/card";
import { initials, shortDate } from "@/shared/lib/utils";
import { getGroupStats } from "../api/queries";
import styles from "./stats.module.css";
import { Motion } from "@/shared/ui/motion";

const megabytes = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;

export async function StatsScreen({ groupId }: { groupId: string }) {
  const data = await getGroupStats(groupId);
  const maxMonth = Math.max(1, ...data.months.map((month) => month.total));
  const maxAttended = Math.max(1, ...data.ranking.map((row) => row.attended));

  return (
    <Motion>
      <header className={styles.header}>
        <Link className={styles.back} href={`/groups/${groupId}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Volver al grupo
        </Link>
        <span className="eyebrow">HISTORIAL Y ESTADÍSTICAS</span>
        <h1>{data.groupName}</h1>
      </header>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className="eyebrow">SALIDAS</span>
          <strong data-count>{data.history.length}</strong>
          <span className="small muted">ya vividas</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">ASISTENCIA MEDIA</span>
          <strong data-count>
            {data.averageAttendance === null
              ? "—"
              : `${data.averageAttendance}%`}
          </strong>
          <span className="small muted">de los miembros por salida</span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">GASTO MEDIO</span>
          <strong data-count>{formatMoney(data.averageCents)}</strong>
          <span className="small muted">
            por salida · {formatMoney(data.totalCents)} en total
          </span>
        </div>
        <div className={styles.kpi}>
          <span className="eyebrow">FOTOS</span>
          <strong data-count>{data.photoCount}</strong>
          <span className="small muted">
            {megabytes(data.usedBytes)} de {megabytes(data.quotaBytes)}
          </span>
        </div>
      </div>

      <div className={styles.charts}>
        <Card>
          <div className={styles.cardHead}>
            <h2>Salidas por mes</h2>
            <span className={styles.range}>
              {data.months[0].label} – {data.months[5].label}
            </span>
          </div>
          <ol
            className={styles.bars}
            aria-label="Salidas por mes en los últimos seis meses"
          >
            {data.months.map((month) => (
              <li key={month.key}>
                <span className={styles.barValue} data-count>
                  {month.total}
                </span>
                <span
                  className={styles.bar}
                  data-grow="y"
                  data-current={month.current || undefined}
                  style={{
                    height: `${Math.max(4, (month.total / maxMonth) * 100)}%`,
                  }}
                  aria-hidden="true"
                />
                <span className={styles.barLabel}>
                  <span className="sr-only">
                    {month.total} {month.total === 1 ? "salida" : "salidas"}{" "}
                    en{" "}
                  </span>
                  {month.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="small muted">
            El mes actual incluye las salidas por venir.
          </p>
        </Card>

        <Card>
          <div className={styles.cardHead}>
            <h2>Ranking de asistencia</h2>
            <span className={styles.range}>CONFIRMADAS</span>
          </div>
          {data.ranking.some((row) => row.invited > 0) ? (
            <ol className={styles.ranking}>
              {data.ranking.map((row, index) => (
                <li key={row.id}>
                  <span className={styles.position}>{index + 1}</span>
                  <span className={styles.face} aria-hidden="true">
                    {initials(row.initialsOf)}
                  </span>
                  <span className={styles.rankInfo}>
                    <strong>{row.name}</strong>
                    <span className={styles.rankBar} aria-hidden="true">
                      <span
                        data-grow="x"
                        style={{
                          width: `${(row.attended / maxAttended) * 100}%`,
                        }}
                      />
                    </span>
                  </span>
                  <span className={styles.rankValue} data-count="first">
                    {row.attended}
                    <small> de {row.invited}</small>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small muted">
              Cuando publiquen salidas y la gente confirme, aquí verán quién no
              se pierde ninguna.
            </p>
          )}
        </Card>
      </div>

      <section aria-labelledby="history-title">
        <div className={styles.cardHead}>
          <h2 id="history-title">Historial</h2>
          <span className="small muted">
            Salidas finalizadas · solo lectura
          </span>
        </div>
        {data.history.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Salida</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className={styles.num}>
                    Fueron
                  </th>
                  <th scope="col" className={styles.num}>
                    Fotos
                  </th>
                  <th scope="col" className={styles.num}>
                    Gasto
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((event) => (
                  <tr key={event.id}>
                    <th scope="row">
                      <Link href={`/groups/${groupId}/events/${event.id}`}>
                        {event.title}
                      </Link>
                      {event.location && (
                        <span className="small muted">{event.location}</span>
                      )}
                    </th>
                    <td>{shortDate(event.startsAt)}</td>
                    <td className={styles.num}>{event.going}</td>
                    <td className={styles.num}>{event.photos}</td>
                    <td className={styles.num}>{formatMoney(event.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className={styles.empty}>
            <History size={28} aria-hidden="true" />
            <p>
              <strong>Todavía no hay salidas finalizadas.</strong>
              <span className="small muted">
                Cuando termine la primera, quedará guardada aquí con su
                asistencia, fotos y gastos.
              </span>
            </p>
          </Card>
        )}
      </section>
    </Motion>
  );
}
