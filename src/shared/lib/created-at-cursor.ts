import "server-only";
import { z } from "zod";

const position = z.tuple([z.iso.datetime({ offset: true }), z.guid()]);

/** Devuelve un cursor estable basado en fecha e identificador. */
export function createdAtCursor(row: { created_at: string; id: string }) {
  return Buffer.from(JSON.stringify([row.created_at, row.id])).toString(
    "base64url",
  );
}

/** Lee una posición validada y construye el filtro para páginas anteriores. */
export function olderThanCursor(cursor?: string) {
  if (!cursor || !/^[A-Za-z0-9_-]{1,180}$/.test(cursor)) return;
  try {
    const parsed = position.safeParse(
      JSON.parse(Buffer.from(cursor, "base64url").toString()),
    );
    if (!parsed.success) return;
    const [at, id] = parsed.data;
    return `created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`;
  } catch {
    return;
  }
}
