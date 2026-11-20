import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { ActionForm } from "@/shared/ui/action-form";
import { initials, timeAgo } from "@/shared/lib/utils";
import { createComment, deleteComment, updateComment } from "../api/actions";
import { getComments } from "../api/queries";
import { CommentsRealtime } from "./comments-realtime";
import styles from "./comments.module.css";

type Thread = Awaited<ReturnType<typeof getComments>>["threads"][number];
type Item = Omit<Thread, "replies"> & { replies?: Thread["replies"] };

// Renderiza los comentarios y sus respuestas dentro de la salida.
export async function CommentsPanel({
  groupId,
  eventId,
  cursor,
}: {
  groupId: string;
  eventId: string;
  cursor?: string;
}) {
  const { threads, total, now, canComment, pastPage, nextCursor } =
    await getComments(groupId, eventId, cursor);
  const commentsUrl = `/groups/${groupId}/events/${eventId}?section=comentarios`;
  const hidden = (
    <>
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="event_id" value={eventId} />
    </>
  );

  const comment = (item: Item, isReply: boolean) => (
    <article
      key={item.id}
      className={isReply ? styles.reply : styles.comment}
      id={`comentario-${item.id}`}
    >
      <span
        className={styles.avatar}
        data-mine={item.mine || undefined}
        aria-hidden="true"
      >
        {initials(item.author)}
      </span>
      <div className={styles.content}>
        <p className={styles.meta}>
          <strong>{item.mine ? "Tú" : item.author}</strong>
          {item.organizer && <span className={styles.badge}>ORGANIZA</span>}
          <time dateTime={item.createdAt}>{timeAgo(item.createdAt, now)}</time>
          {item.edited && <span>· editado</span>}
        </p>
        <p className={styles.body}>{item.body}</p>
        <div className={styles.actions}>
          {canComment && !isReply && (
            <details>
              <summary>Responder</summary>
              <ActionForm
                action={createComment}
                label="Responder"
                className={styles.inlineForm}
              >
                {hidden}
                <input type="hidden" name="parent_id" value={item.id} />
                <textarea
                  className="input"
                  name="body"
                  required
                  maxLength={2000}
                  rows={2}
                  aria-label={`Responder a ${item.author}`}
                  placeholder={`Responder a ${item.author.split(" ")[0]}…`}
                />
              </ActionForm>
            </details>
          )}
          {item.canEdit && (
            <details>
              <summary>Editar</summary>
              <ActionForm
                action={updateComment}
                label="Guardar"
                className={styles.inlineForm}
              >
                {hidden}
                <input type="hidden" name="id" value={item.id} />
                <textarea
                  className="input"
                  name="body"
                  required
                  maxLength={2000}
                  rows={2}
                  aria-label="Editar comentario"
                  defaultValue={item.body}
                />
              </ActionForm>
            </details>
          )}
          {item.canDelete && (
            <details>
              <summary className={styles.danger}>Eliminar</summary>
              <ActionForm
                action={deleteComment}
                label={
                  item.replies?.length
                    ? "Eliminar con sus respuestas"
                    : "Sí, eliminar"
                }
                tone="danger"
                className={styles.inlineForm}
              >
                {hidden}
                <input type="hidden" name="id" value={item.id} />
              </ActionForm>
            </details>
          )}
        </div>
        {item.replies && item.replies.length > 0 && (
          <div className={styles.replies}>
            {item.replies.map((reply) => comment(reply, true))}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <Card className={styles.panel} aria-labelledby="comments-title">
      <CommentsRealtime
        eventId={eventId}
        commentIds={threads
          .flatMap((thread) => [thread, ...thread.replies])
          .map((item) => item.id)
          .join(",")}
      />
      <div className={styles.heading}>
        <h2 id="comments-title">Comentarios</h2>
        <span className="count">{total}</span>
      </div>
      {nextCursor && (
        <Link
          className={styles.more}
          href={`${commentsUrl}&comentarios=${nextCursor}#comments-title`}
          scroll={false}
          prefetch={false}
        >
          Ver comentarios anteriores
        </Link>
      )}
      {threads.length ? (
        <div className={styles.threads}>
          {threads.map((thread) => comment(thread, false))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className="tile-icon" aria-hidden="true">
            <MessageCircle size={20} />
          </span>
          <p>
            <strong>Aún nadie ha escrito.</strong>
            <span className="small muted">
              {canComment
                ? "Coordina aquí los detalles: quién lleva qué, a qué hora salen…"
                : "Los comentarios se habilitan cuando la salida está publicada."}
            </span>
          </p>
        </div>
      )}
      {pastPage ? (
        <Link className={styles.more} href={`${commentsUrl}#comments-title`}>
          Volver a los comentarios recientes
        </Link>
      ) : (
        canComment && (
          <ActionForm
            action={createComment}
            label="Enviar"
            className={styles.composer}
          >
            {hidden}
            <textarea
              className="input"
              name="body"
              required
              maxLength={2000}
              rows={2}
              aria-label="Escribe un comentario"
              placeholder="Escribe al grupo…"
            />
          </ActionForm>
        )
      )}
    </Card>
  );
}
