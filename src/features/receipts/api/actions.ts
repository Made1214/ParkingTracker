"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, type ActionState } from "@/shared/lib/forms";
import { imageValidationError } from "@/shared/lib/images";
import {
  deletePrivateImage,
  mediaConfigured,
  uploadPrivateImage,
} from "@/shared/cloudinary/server";
import { computeReceipt } from "../lib/engine";
import {
  emptyDocument,
  receiptDocumentSchema,
  toEngineInput,
  toLedgerParticipants,
} from "../lib/document";
import { buildReceiptExpenses } from "../lib/ledger";
import { buildSnapshot, readResult } from "../lib/snapshot";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refs = z.object({
  groupId: z.guid(),
  eventId: z.guid(),
  receiptId: z.guid(),
  version: z.number().int().positive(),
});
type Refs = z.infer<typeof refs>;

const eventPath = (groupId: string, eventId: string) =>
  `/groups/${groupId}/events/${eventId}`;
const receiptPath = (r: Pick<Refs, "groupId" | "eventId" | "receiptId">) =>
  `${eventPath(r.groupId, r.eventId)}/receipts/${r.receiptId}`;

function receiptError(code?: string, message?: string) {
  if (code === "40001" || message?.includes("version conflict"))
    return "La factura cambió en otro dispositivo. Recarga para ver la última versión.";
  if (message?.includes("is finalized"))
    return "La factura ya está finalizada. Reábrela para corregirla.";
  if (message?.includes("settled payments"))
    return "Ya hay pagos de esta factura marcados como saldados; no se puede reabrir.";
  if (message?.includes("cancelled"))
    return "La salida está cancelada: ya no admite gastos.";
  if (message?.includes("payer must") || message?.includes("participant must"))
    return "Quien paga o participa como miembro tiene que ser del grupo.";
  if (message?.includes("guest must"))
    return "Un invitado no pertenece a esta salida.";
  if (message?.includes("must add up"))
    return "Los importes no cuadran con el total de la factura.";
  if (code === "42501") return "No tienes permiso para hacer esto.";
  return "No se pudo guardar. Inténtalo de nuevo.";
}

/** Crea un borrador con quien escanea como primer participante. */
export async function startReceipt(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z.object({ group_id: z.guid(), event_id: z.guid() }).safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!ids.success) return { error: "La salida no es válida." };
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const document = emptyDocument();
  document.participants.push({
    id: user.id,
    name: profile?.display_name ?? "Yo",
    kind: "member",
    userId: user.id,
  });
  const { data, error } = await supabase
    .from("receipts")
    .insert({
      group_id: ids.data.group_id,
      event_id: ids.data.event_id,
      created_by: user.id,
      document,
    })
    .select("id")
    .single();
  if (error) return { error: receiptError(error.code, error.message) };
  redirect(
    receiptPath({
      groupId: ids.data.group_id,
      eventId: ids.data.event_id,
      receiptId: data.id,
    }),
  );
}

/** Guarda el borrador (autoguardado). Bloqueo optimista por versión. */
export async function saveReceiptDraft(
  input: Refs & { document: unknown },
): Promise<Result<{ version: number }>> {
  const ids = refs.safeParse(input);
  const document = receiptDocumentSchema.safeParse(input.document);
  if (!ids.success) return { ok: false, error: "La factura no es válida." };
  if (!document.success)
    return { ok: false, error: "Hay datos de la factura que no son válidos." };
  const { supabase } = await requireUser();
  const { groupId, eventId, receiptId, version } = ids.data;
  const doc = document.data;
  const { data, error } = await supabase
    .from("receipts")
    .update({
      document: doc,
      merchant: doc.merchant || null,
      receipt_date: doc.date,
      printed_total_cents: doc.printedTotalCents,
      version: version + 1,
    })
    .eq("id", receiptId)
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .eq("version", version)
    .eq("status", "draft")
    .select("version")
    .maybeSingle();
  if (error)
    return { ok: false, error: receiptError(error.code, error.message) };
  if (!data) return { ok: false, error: receiptError("40001") };
  return { ok: true, version: data.version };
}

/** Sube la foto (ya reducida en el navegador) a Cloudinary privado. */
export async function uploadReceiptImage(
  form: FormData,
): Promise<Result<{ version: number }>> {
  const ids = refs.safeParse({
    groupId: text(form, "group_id"),
    eventId: text(form, "event_id"),
    receiptId: text(form, "receipt_id"),
    version: Number(text(form, "version")),
  });
  if (!ids.success) return { ok: false, error: "La factura no es válida." };
  const file = form.get("image");
  if (!(file instanceof File))
    return { ok: false, error: "Selecciona una imagen." };
  const invalid = await imageValidationError(file);
  if (invalid) return { ok: false, error: invalid };
  if (!mediaConfigured())
    return {
      ok: false,
      error:
        "La subida de imágenes aún no está disponible. Puedes seguir sin foto.",
    };
  const { supabase, user } = await requireUser();
  const { groupId, eventId, receiptId, version } = ids.data;
  const { data: current, error: readError } = await supabase
    .from("receipts")
    .select("image_public_id, created_by, version, status")
    .eq("id", receiptId)
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (readError || !current) return { ok: false, error: receiptError("42501") };

  // Verifica los permisos y el estado antes de transferir el archivo.
  if (current.created_by !== user.id) {
    const { data: admin } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!admin) return { ok: false, error: receiptError("42501") };
  }
  if (current.status !== "draft")
    return {
      ok: false,
      error: receiptError(undefined, "receipt is finalized"),
    };
  if (current.version !== version)
    return { ok: false, error: receiptError("40001") };
  const { data: event } = await supabase
    .from("events")
    .select("status")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!event) return { ok: false, error: receiptError("42501") };
  if (event.status === "cancelled")
    return { ok: false, error: receiptError(undefined, "event is cancelled") };

  const publicId = `receipts/${groupId}/${eventId}/${randomUUID()}`;
  try {
    await uploadPrivateImage(file, publicId, { width: 2400, height: 2400 });
  } catch {
    return {
      ok: false,
      error: "No se pudo subir la foto. Inténtalo de nuevo.",
    };
  }
  const { data, error } = await supabase
    .from("receipts")
    .update({ image_public_id: publicId, version: version + 1 })
    .eq("id", receiptId)
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .eq("version", version)
    .eq("status", "draft")
    .select("version")
    .maybeSingle();
  if (error || !data) {
    await deletePrivateImage(publicId).catch(() =>
      console.error("Failed to clean up an uncommitted receipt image"),
    );
    return {
      ok: false,
      error: receiptError(error?.code ?? "40001", error?.message),
    };
  }
  if (current.image_public_id)
    await deletePrivateImage(current.image_public_id).catch(() =>
      console.error("Failed to clean up a replaced receipt image"),
    );
  return { ok: true, version: data.version };
}

/** Agrega (o reutiliza por nombre) un invitado de la salida. */
export async function addEventGuest(input: {
  groupId: string;
  eventId: string;
  name: string;
}): Promise<Result<{ guest: { id: string; name: string } }>> {
  const parsed = z
    .object({
      groupId: z.guid(),
      eventId: z.guid(),
      name: z.string().trim().min(1).max(60),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Escribe un nombre de hasta 60 caracteres." };
  const { supabase, user } = await requireUser();
  const { groupId, eventId, name } = parsed.data;
  const { data: existing } = await supabase
    .from("event_guests")
    .select("id, display_name")
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .ilike(
      "display_name",
      name.replace(/[\\%_]/g, (c) => `\\${c}`),
    );
  if (existing?.length)
    return {
      ok: true,
      guest: { id: existing[0].id, name: existing[0].display_name },
    };
  const { data, error } = await supabase
    .from("event_guests")
    .insert({
      group_id: groupId,
      event_id: eventId,
      display_name: name,
      created_by: user.id,
    })
    .select("id, display_name")
    .single();
  if (error)
    return { ok: false, error: receiptError(error.code, error.message) };
  return { ok: true, guest: { id: data.id, name: data.display_name } };
}

/**
 * Finaliza la factura: recalcula en el servidor (nunca confía en totales del
 * cliente), comprueba duplicados y crea los gastos en una sola transacción.
 */
export async function finalizeReceipt(
  input: Refs & { document: unknown; confirmDuplicate?: boolean },
): Promise<
  Result<{ version: number }> | { ok: false; duplicate: true; error: string }
> {
  const ids = refs.safeParse(input);
  const document = receiptDocumentSchema.safeParse(input.document);
  if (!ids.success || !document.success)
    return { ok: false, error: "Hay datos de la factura que no son válidos." };
  const doc = document.data;
  const result = computeReceipt(toEngineInput(doc));
  if (!result.canFinalize)
    return {
      ok: false,
      error:
        result.issues.find((i) => i.severity === "error")?.message ??
        "La factura tiene datos por resolver.",
    };
  const snapshot = buildSnapshot(doc, result);
  if ("error" in snapshot) return { ok: false, error: snapshot.error };
  const ledger = buildReceiptExpenses(
    toLedgerParticipants(doc),
    new Map(result.people.map((p) => [p.participantId, p.totalCents])),
    doc.payments,
  );
  if (!ledger.ok) return { ok: false, error: ledger.error };

  const { supabase } = await requireUser();
  const { groupId, eventId, receiptId, version } = ids.data;

  if (snapshot.fingerprint && !input.confirmDuplicate) {
    const { data: others } = await supabase
      .from("receipts")
      .select("id, result")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .eq("status", "finalized")
      .neq("id", receiptId);
    if (
      others?.some(
        (o) => readResult(o.result)?.fingerprint === snapshot.fingerprint,
      )
    )
      return {
        ok: false,
        duplicate: true,
        error:
          "Ya hay una factura igual (mismo comercio, fecha y total) en esta salida. ¿Seguro que no está repetida?",
      };
  }

  const { data, error } = await supabase.rpc("finalize_receipt", {
    p_receipt_id: receiptId,
    p_version: version,
    p_printed_total_cents: doc.printedTotalCents!,
    p_merchant: doc.merchant ?? "",
    p_receipt_date: doc.date,
    p_document: doc,
    p_result: snapshot,
    p_expenses: ledger.expenses,
  });
  if (error)
    return { ok: false, error: receiptError(error.code, error.message) };
  revalidatePath(eventPath(groupId, eventId));
  revalidatePath(receiptPath(ids.data));
  return { ok: true, version: data };
}

/** Reabre una factura finalizada (borra sus gastos) para corregirla. */
export async function reopenReceipt(
  input: Refs,
): Promise<Result<{ version: number }>> {
  const ids = refs.safeParse(input);
  if (!ids.success) return { ok: false, error: "La factura no es válida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reopen_receipt", {
    p_receipt_id: ids.data.receiptId,
    p_version: ids.data.version,
  });
  if (error)
    return { ok: false, error: receiptError(error.code, error.message) };
  revalidatePath(eventPath(ids.data.groupId, ids.data.eventId));
  revalidatePath(receiptPath(ids.data));
  return { ok: true, version: data };
}

/** Borra un borrador y su foto. Las finalizadas se reabren primero. */
export async function deleteReceipt(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z
    .object({ group_id: z.guid(), event_id: z.guid(), receipt_id: z.guid() })
    .safeParse({
      group_id: text(form, "group_id"),
      event_id: text(form, "event_id"),
      receipt_id: text(form, "receipt_id"),
    });
  if (!ids.success) return { error: "La factura no es válida." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("receipts")
    .delete()
    .eq("id", ids.data.receipt_id)
    .eq("group_id", ids.data.group_id)
    .eq("event_id", ids.data.event_id)
    .eq("status", "draft")
    .select("image_public_id");
  if (error) return { error: receiptError(error.code, error.message) };
  if (!data.length)
    return { error: "Solo quien la creó o un admin puede borrar un borrador." };
  if (data[0].image_public_id)
    await deletePrivateImage(data[0].image_public_id).catch(() =>
      console.error("Failed to delete a receipt image"),
    );
  redirect(`${eventPath(ids.data.group_id, ids.data.event_id)}?section=gastos`);
}

/** Marca como cobrado lo que un invitado le debe a quien pagó. */
export async function settleGuestDebt(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z
    .object({
      group_id: z.guid(),
      event_id: z.guid(),
      guest_id: z.guid(),
      creditor: z.guid(),
    })
    .safeParse({
      group_id: text(form, "group_id"),
      event_id: text(form, "event_id"),
      guest_id: text(form, "guest_id"),
      creditor: text(form, "creditor"),
    });
  if (!ids.success) return { error: "La deuda no es válida." };
  const { supabase } = await requireUser();
  const { data: expenses, error: readError } = await supabase
    .from("expenses")
    .select("id")
    .eq("group_id", ids.data.group_id)
    .eq("event_id", ids.data.event_id)
    .eq("paid_by", ids.data.creditor);
  if (readError) return { error: receiptError(readError.code) };
  const { data, error } = await supabase
    .from("expense_guest_shares")
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq("group_id", ids.data.group_id)
    .eq("guest_id", ids.data.guest_id)
    .eq("settled", false)
    .in(
      "expense_id",
      expenses.map((e) => e.id),
    )
    .select("id");
  if (error) return { error: receiptError(error.code, error.message) };
  if (!data.length)
    return { error: "Solo quien pagó o un admin puede marcarlo como cobrado." };
  revalidatePath(eventPath(ids.data.group_id, ids.data.event_id));
  return { success: "Marcado como cobrado." };
}
