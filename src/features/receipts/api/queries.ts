import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { readDocument, type ReceiptDocument } from "../lib/document";
import { readResult, type ReceiptSnapshot } from "../lib/snapshot";

const cents = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

export type ReceiptPageData = {
  groupId: string;
  eventId: string;
  receiptId: string;
  userId: string;
  eventTitle: string;
  status: "draft" | "finalized";
  version: number;
  canEdit: boolean;
  eventOpen: boolean;
  hasImage: boolean;
  document: ReceiptDocument;
  result: ReceiptSnapshot | null;
  members: { id: string; name: string }[];
  guests: { id: string; name: string }[];
};

export async function getReceiptPage(
  groupId: string,
  eventId: string,
  receiptId: string,
): Promise<ReceiptPageData> {
  if (
    ![groupId, eventId, receiptId].every((id) => z.guid().safeParse(id).success)
  )
    notFound();
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}/receipts/${receiptId}`,
  );
  const [receipt, members, guests, event] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        "id, status, version, created_by, document, result, image_public_id",
      )
      .eq("id", receiptId)
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
    supabase
      .from("event_guests")
      .select("id, display_name")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at"),
    supabase
      .from("events")
      .select("title, status")
      .eq("group_id", groupId)
      .eq("id", eventId)
      .maybeSingle(),
  ]);
  if (receipt.error || members.error || guests.error || event.error)
    throw new Error("No se pudo cargar la factura.");
  if (!receipt.data || !event.data) notFound();
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );
  return {
    groupId,
    eventId,
    receiptId,
    userId: user.id,
    eventTitle: event.data.title,
    status: receipt.data.status === "finalized" ? "finalized" : "draft",
    version: receipt.data.version,
    canEdit: isAdmin || receipt.data.created_by === user.id,
    eventOpen: event.data.status !== "cancelled",
    hasImage: Boolean(receipt.data.image_public_id),
    document: readDocument(receipt.data.document),
    result: readResult(receipt.data.result),
    members: members.data
      .map((m) => ({
        id: m.user_id,
        name: m.profiles?.display_name ?? "Miembro",
      }))
      .sort((a, b) =>
        a.id === user.id
          ? -1
          : b.id === user.id
            ? 1
            : a.name.localeCompare(b.name),
      ),
    guests: guests.data.map((g) => ({ id: g.id, name: g.display_name })),
  };
}

/** Facturas y deudas de invitados de una salida, para la pestaña Gastos. */
export async function getEventReceipts(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const [receipts, shares, members] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        "id, status, document, created_by, created_at, printed_total_cents",
      )
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("expense_guest_shares")
      .select(
        "id, share_amount, guest_id, event_guests(display_name), expenses!inner(event_id, paid_by)",
      )
      .eq("group_id", groupId)
      .eq("expenses.event_id", eventId)
      .eq("settled", false),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
  ]);
  if (receipts.error || shares.error || members.error)
    throw new Error("No se pudieron cargar las facturas.");
  const names = new Map(
    members.data.map((m) => [
      m.user_id,
      m.user_id === user.id ? "Tú" : (m.profiles?.display_name ?? "Miembro"),
    ]),
  );
  const isAdmin = members.data.some(
    (m) => m.user_id === user.id && m.role === "admin",
  );

  const debts = new Map<
    string,
    {
      guestId: string;
      guestName: string;
      creditorId: string;
      creditorName: string;
      cents: number;
      canSettle: boolean;
    }
  >();
  for (const share of shares.data) {
    const creditorId = share.expenses.paid_by;
    const key = `${share.guest_id}:${creditorId}`;
    const entry = debts.get(key) ?? {
      guestId: share.guest_id,
      guestName: share.event_guests?.display_name ?? "Invitado",
      creditorId,
      creditorName: names.get(creditorId) ?? "Ex miembro",
      cents: 0,
      canSettle: isAdmin || creditorId === user.id,
    };
    entry.cents += cents(share.share_amount);
    debts.set(key, entry);
  }

  return {
    receipts: receipts.data.map((r) => {
      const doc = readDocument(r.document);
      return {
        id: r.id,
        status: r.status,
        merchant: doc.merchant,
        totalCents: r.printed_total_cents ?? doc.printedTotalCents,
        people: doc.participants.length,
        mine: r.created_by === user.id,
      };
    }),
    guestDebts: [...debts.values()].sort((a, b) => b.cents - a.cents),
  };
}
