import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/features/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import { getEventReceipts, getReceiptPage } from "./queries";
import { emptyDocument } from "../lib/document";

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const RECEIPT_ID = "33333333-3333-4333-8333-333333333333";

function chain(result: unknown) {
  const obj = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    order: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

describe("receipts queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida UUIDs y construye los datos de la página de factura", async () => {
    await expect(getReceiptPage("bad", EVENT_ID, RECEIPT_ID)).rejects.toThrow(
      "NOT_FOUND",
    );

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({
            data: {
              id: RECEIPT_ID,
              status: "draft",
              version: 2,
              created_by: "u2",
              document: {},
              result: null,
              image_public_id: "receipts/1/img",
            },
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                user_id: "u2",
                role: "member",
                profiles: { display_name: "Zoe" },
              },
              {
                user_id: "u1",
                role: "admin",
                profiles: { display_name: "Ana" },
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [{ id: "gst-1", display_name: "Invitado 1" }],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({ data: { title: "Cena", status: "published" }, error: null }),
        ),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "u1" } });

    const page = await getReceiptPage(GROUP_ID, EVENT_ID, RECEIPT_ID);
    expect(page.canEdit).toBe(true);
    expect(page.eventOpen).toBe(true);
    expect(page.hasImage).toBe(true);
    expect(page.members.map((m) => m.id)).toEqual(["u1", "u2"]);
    expect(page.guests).toEqual([{ id: "gst-1", name: "Invitado 1" }]);
  });

  it("agrega deudas de invitados y permisos en getEventReceipts", async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: RECEIPT_ID,
                status: "finalized",
                document: { ...emptyDocument(), merchant: "Fonda" },
                created_by: "u1",
                created_at: "2026-11-20T00:00:00Z",
                printed_total_cents: 2500,
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                id: "s1",
                share_amount: 10,
                guest_id: "gst-1",
                event_guests: { display_name: "Carlos" },
                expenses: { event_id: EVENT_ID, paid_by: "u1" },
              },
              {
                id: "s2",
                share_amount: 5.5,
                guest_id: "gst-1",
                event_guests: { display_name: "Carlos" },
                expenses: { event_id: EVENT_ID, paid_by: "u1" },
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [
              {
                user_id: "u1",
                role: "member",
                profiles: { display_name: "Ana" },
              },
            ],
            error: null,
          }),
        )
        .mockReturnValueOnce(
          chain({
            data: [{ id: "gst-1", display_name: "Carlos", created_by: "u1" }],
            error: null,
          }),
        ),
    };
    mocks.requireUser.mockResolvedValue({ supabase, user: { id: "u1" } });

    const data = await getEventReceipts(GROUP_ID, EVENT_ID);
    expect(data.receipts[0]).toMatchObject({
      merchant: "Fonda",
      totalCents: 2500,
      mine: true,
    });
    expect(data.guestDebts).toEqual([
      {
        guestId: "gst-1",
        guestName: "Carlos",
        creditorId: "u1",
        creditorName: "Tú",
        cents: 1550,
        canSettle: true,
      },
    ]);
    expect(data.guests[0]?.canManage).toBe(true);
  });
});
