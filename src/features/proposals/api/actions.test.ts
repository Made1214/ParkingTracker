import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/features/auth", () => ({ requireUser: mocks.session }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { closePoll, createPoll, createProposal, reviewProposal, vote } from "./actions";

const group = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000002";
const proposal = "30000000-0000-4000-8000-000000000003";
const poll = "40000000-0000-4000-8000-000000000004";
const optionA = "50000000-0000-4000-8000-000000000005";
const optionB = "60000000-0000-4000-8000-000000000006";
const eventPath = `/groups/${group}/events/${event}`;

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of Array.isArray(value) ? value : [value])
      data.append(key, item);
  return data;
}

describe("proposal and poll mutations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({
      user: { id: "user" },
      supabase: { rpc: mocks.rpc },
    });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  describe("createProposal", () => {
    it("publishes a proposal and revalidates the event page", async () => {
      const result = await createProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          title: " Asado en la playa ",
          description: " Salida de fin de mes ",
        }),
      );
      expect(result.success).toContain("publicada");
      expect(mocks.rpc).toHaveBeenCalledWith("create_activity_proposal", {
        p_event_id: event,
        p_title: "Asado en la playa",
        p_description: "Salida de fin de mes",
      });
      expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
    });
    it("rejects an empty title before calling the database", async () => {
      const result = await createProposal(
        {},
        form({ group_id: group, event_id: event, title: "  " }),
      );
      expect(result.error).toContain("título");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
    it("rejects a description over the limit", async () => {
      const result = await createProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          title: "Asado",
          description: "x".repeat(2001),
        }),
      );
      expect(result.error).toBeTruthy();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("rejects malformed identifiers", async () => {
      const result = await createProposal(
        {},
        form({
          group_id: "not-a-guid",
          event_id: event,
          title: "Asado",
        }),
      );
      expect(result.error).toBeTruthy();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it.each([
      ["42501", "No tienes permiso para realizar esta acción."],
      ["XX000", "No se pudo guardar. Inténtalo de nuevo."],
    ])("maps RPC error %s to a friendly message", async (code, message) => {
      mocks.rpc.mockResolvedValue({ error: { code } });
      const result = await createProposal(
        {},
        form({ group_id: group, event_id: event, title: "Asado" }),
      );
      expect(result.error).toBe(message);
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
  });

  describe("createPoll", () => {
    it("creates a poll with cleaned options and a deadline", async () => {
      const result = await createPoll(
        {},
        form({
          group_id: group,
          event_id: event,
          question: "¿A dónde vamos?",
          options: "Playa\n Montaña \n\nBosque",
          closes_at: "2099-01-01T12:00",
          allow_multiple: "on",
        }),
      );
      expect(result.success).toContain("Votación creada");
      expect(mocks.rpc).toHaveBeenCalledWith(
        "create_poll",
        expect.objectContaining({
          p_event_id: event,
          p_question: "¿A dónde vamos?",
          p_options: ["Playa", "Montaña", "Bosque"],
          p_allow_multiple: true,
          p_closes_at: new Date("2099-01-01T12:00-05:00").toISOString(),
        }),
      );
      expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
    });
    it("defaults to a single-choice poll without a deadline", async () => {
      await createPoll(
        {},
        form({
          group_id: group,
          event_id: event,
          question: "¿A dónde vamos?",
          options: "Playa\nMontaña",
        }),
      );
      expect(mocks.rpc).toHaveBeenCalledWith(
        "create_poll",
        expect.objectContaining({ p_allow_multiple: false }),
      );
      const args = mocks.rpc.mock.calls[0][1];
      expect(args.p_closes_at).toBeUndefined();
    });
    it.each([
      ["a single option", { options: "Solo playa" }],
      ["duplicate options", { options: "Playa\nPlaya" }],
      ["an option over the limit", { options: `Playa\n${"x".repeat(101)}` }],
      ["an empty question", { question: " ", options: "Playa\nMontaña" }],
      [
        "a question over the limit",
        { question: "x".repeat(201), options: "Playa\nMontaña" },
      ],
      [
        "a deadline in the past",
        { options: "Playa\nMontaña", closes_at: "2000-01-01T12:00" },
      ],
      [
        "a malformed deadline",
        { options: "Playa\nMontaña", closes_at: "nunca" },
      ],
    ])("rejects %s before calling the database", async (_name, values) => {
      const result = await createPoll(
        {},
        form({
          group_id: group,
          event_id: event,
          question: "¿A dónde vamos?",
          options: "Playa\nMontaña",
          ...values,
        }),
      );
      expect(result.error).toContain("Revisa la pregunta");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("maps an RPC rejection to a friendly message", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "23514" } });
      const result = await createPoll(
        {},
        form({
          group_id: group,
          event_id: event,
          question: "¿A dónde vamos?",
          options: "Playa\nMontaña",
        }),
      );
      expect(result.error).toContain("Revisa los datos");
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
  });

  describe("reviewProposal", () => {
    it("records the organizer decision and revalidates", async () => {
      const result = await reviewProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          proposal_id: proposal,
          status: "accepted",
        }),
      );
      expect(result.success).toContain("Decisión");
      expect(mocks.rpc).toHaveBeenCalledWith("review_activity_proposal", {
        p_proposal_id: proposal,
        p_status: "accepted",
      });
      expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
    });
    it("rejects an unknown decision before touching the session", async () => {
      const result = await reviewProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          proposal_id: proposal,
          status: "maybe",
        }),
      );
      expect(result.error).toContain("propuesta o decisión");
      expect(mocks.session).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("rejects a malformed proposal identifier", async () => {
      const result = await reviewProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          proposal_id: "nope",
          status: "rejected",
        }),
      );
      expect(result.error).toBeTruthy();
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it.each([
      ["55000", "El evento ya no admite cambios."],
      ["42501", "No tienes permiso para realizar esta acción."],
    ])("maps RPC error %s to a friendly message", async (code, message) => {
      mocks.rpc.mockResolvedValue({ error: { code } });
      const result = await reviewProposal(
        {},
        form({
          group_id: group,
          event_id: event,
          proposal_id: proposal,
          status: "accepted",
        }),
      );
      expect(result.error).toBe(message);
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
  });

  describe("vote", () => {
    it("casts a vote for a single option", async () => {
      const result = await vote(
        {},
        form({
          group_id: group,
          event_id: event,
          poll_id: poll,
          option_id: optionA,
        }),
      );
      expect(result.success).toContain("voto");
      expect(mocks.rpc).toHaveBeenCalledWith("cast_vote", {
        p_poll_id: poll,
        p_option_ids: [optionA],
      });
      expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
    });
    it("casts every selected option when the poll allows it", async () => {
      await vote(
        {},
        form({
          group_id: group,
          event_id: event,
          poll_id: poll,
          option_id: [optionA, optionB],
        }),
      );
      expect(mocks.rpc).toHaveBeenCalledWith("cast_vote", {
        p_poll_id: poll,
        p_option_ids: [optionA, optionB],
      });
    });
    it("rejects an empty selection before calling the database", async () => {
      const result = await vote(
        {},
        form({ group_id: group, event_id: event, poll_id: poll }),
      );
      expect(result.error).toContain("opción válida");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it.each([
      ["a malformed option", { option_id: "nope" }],
      ["a malformed poll", { poll_id: "nope" }],
    ])("rejects %s before calling the database", async (_name, values) => {
      const result = await vote(
        {},
        form({
          group_id: group,
          event_id: event,
          poll_id: poll,
          option_id: optionA,
          ...values,
        }),
      );
      expect(result.error).toContain("opción válida");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("explains a closed poll without revalidating", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "55000" } });
      const result = await vote(
        {},
        form({
          group_id: group,
          event_id: event,
          poll_id: poll,
          option_id: optionA,
        }),
      );
      expect(result.error).toBe("La votación está cerrada.");
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
  });

  describe("closePoll", () => {
    it("closes an open poll and revalidates", async () => {
      const result = await closePoll(
        {},
        form({ group_id: group, event_id: event, poll_id: poll }),
      );
      expect(result.success).toContain("cerrada");
      expect(mocks.rpc).toHaveBeenCalledWith("close_poll", { p_poll_id: poll });
      expect(mocks.revalidate).toHaveBeenCalledWith(eventPath);
    });
    it("rejects malformed identifiers before calling the database", async () => {
      const result = await closePoll(
        {},
        form({ group_id: group, event_id: event, poll_id: "nope" }),
      );
      expect(result.error).toContain("inválida");
      expect(mocks.rpc).not.toHaveBeenCalled();
    });
    it("maps an RPC rejection to a friendly message", async () => {
      mocks.rpc.mockResolvedValue({ error: { code: "42501" } });
      const result = await closePoll(
        {},
        form({ group_id: group, event_id: event, poll_id: poll }),
      );
      expect(result.error).toBe("No tienes permiso para realizar esta acción.");
      expect(mocks.revalidate).not.toHaveBeenCalled();
    });
  });
});
