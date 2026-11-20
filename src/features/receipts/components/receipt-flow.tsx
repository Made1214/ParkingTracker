"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  ScanLine,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { initials } from "@/shared/lib/utils";
import {
  addEventGuest,
  finalizeReceipt,
  saveReceiptDraft,
  uploadReceiptImage,
} from "../api/actions";
import { computeReceipt, type ItemAllocation } from "../lib/engine";
import {
  establishmentTypes,
  itemCategories,
  paymentMethods,
  toEngineInput,
  type DocumentCharge,
  type DocumentItem,
  type DocumentTax,
  type ReceiptDocument,
} from "../lib/document";
import { findRepeatedItems } from "../lib/review";
import { panamaTaxProfile } from "../lib/tax-rules/panama";
import { parseReceiptLines } from "../lib/ocr-parse";
import { computeSettlement } from "../lib/settlement";
import type { ReceiptPageData } from "../api/queries";
import { ReceiptImage, type Highlight } from "./receipt-image";
import {
  LOW_CONFIDENCE,
  money,
  moneyInput,
  newId,
  personTone,
  readMoney,
} from "./helpers";
import styles from "./receipts.module.css";

const steps = [
  { value: "scan", label: "Escanear" },
  { value: "review", label: "Revisar" },
  { value: "people", label: "Personas" },
  { value: "assign", label: "Asignar" },
  { value: "pay", label: "Pagos" },
  { value: "confirm", label: "Confirmar" },
] as const;
type Step = (typeof steps)[number]["value"];

const establishmentLabels: Record<(typeof establishmentTypes)[number], string> =
  {
    restaurant_with_alcohol: "Restaurante (vende alcohol)",
    restaurant_without_alcohol: "Restaurante sin alcohol",
    bar: "Bar",
    supermarket: "Supermercado",
    pharmacy: "Farmacia",
    other: "Otro",
  };
const categoryLabels: Record<(typeof itemCategories)[number], string> = {
  food: "Comida",
  non_alcoholic_beverage: "Bebida sin alcohol",
  alcoholic_beverage: "Bebida alcohólica",
  tobacco: "Tabaco",
  groceries_basic: "Canasta básica",
  medicine: "Medicamento",
  service: "Servicio",
  other: "Otro",
};
const methodLabels: Record<(typeof paymentMethods)[number], string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  yappy: "Yappy",
  transfer: "Transferencia",
  other: "Otro",
};
const chargeLabels: Record<DocumentCharge["kind"], string> = {
  tip: "Propina",
  service_charge: "Cargo por servicio",
  other_charge: "Otro cargo",
  discount: "Descuento",
  adjustment: "Ajuste",
};

type SaveState = "saved" | "saving" | "dirty" | "error";

export function ReceiptFlow({ data }: { data: ReceiptPageData }) {
  const router = useRouter();
  const [doc, setDoc] = useState(data.document);
  const [step, setStep] = useState<Step>(
    data.document.items.length || data.hasImage ? "review" : "scan",
  );
  const [imageSrc, setImageSrc] = useState<string | null>(
    data.hasImage
      ? `/api/groups/${data.groupId}/events/${data.eventId}/receipts/${data.receiptId}/image?v=${data.version}`
      : null,
  );
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const version = useRef(data.version);
  const queue = useRef(Promise.resolve());
  const latest = useRef(doc);
  const ids = {
    groupId: data.groupId,
    eventId: data.eventId,
    receiptId: data.receiptId,
  };

  const update = useCallback(
    (change: (d: ReceiptDocument) => ReceiptDocument) => {
      setDoc((current) => {
        const next = change(current);
        latest.current = next;
        return next;
      });
      setSave("dirty");
    },
    [],
  );

  // Serializa las operaciones y deja disponible la cola tras un fallo.
  const enqueue = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = queue.current.then(operation);
    queue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  // Guarda el último documento respetando su versión en el servidor.
  const flush = useCallback(() => {
    return enqueue(async () => {
      setSave("saving");
      const result = await saveReceiptDraft({
        ...ids,
        version: version.current,
        document: latest.current,
      });
      if (result.ok) {
        version.current = result.version;
        setSave((s) => (s === "saving" ? "saved" : s));
        setError(null);
      } else {
        setSave("error");
        setError(result.error);
      }
      return result;
    }).catch(() => {
      const error = "No se pudo guardar el borrador. Inténtalo de nuevo.";
      setSave("error");
      setError(error);
      return { ok: false as const, error };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueue]);

  useEffect(() => {
    if (save !== "dirty" || !data.canEdit) return;
    const timer = setTimeout(flush, 900);
    return () => clearTimeout(timer);
  }, [doc, save, flush, data.canEdit]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (save !== "saved") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const result = useMemo(() => computeReceipt(toEngineInput(doc)), [doc]);
  const totals = new Map(
    result.people.map((p) => [p.participantId, p.totalCents]),
  );
  const tone = new Map(doc.participants.map((p, i) => [p.id, personTone(i)]));
  const errors = result.issues.filter((i) => i.severity === "error");
  const unassigned = doc.items.filter(
    (item) => !doc.allocations.some((a) => a.itemId === item.id),
  );
  const paidCents = doc.payments.reduce((a, p) => a + p.cents, 0);
  const index = steps.findIndex((s) => s.value === step);

  if (!data.canEdit)
    return (
      <p className="message">
        Este borrador lo está preparando otra persona. Podrás ver tu parte
        cuando lo finalice.
      </p>
    );

  return (
    <div className={styles.flow}>
      <nav className={styles.stepper} aria-label="Pasos de la factura">
        <ol>
          {steps.map((s, i) => (
            <li key={s.value}>
              <button
                type="button"
                aria-current={s.value === step ? "step" : undefined}
                data-done={i < index || undefined}
                onClick={() => setStep(s.value)}
              >
                <span className={styles.stepNumber}>
                  {i < index ? <Check size={14} /> : i + 1}
                </span>
                <span className={styles.stepLabel}>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <span className={styles.saveState} role="status">
          {save === "saving"
            ? "Guardando…"
            : save === "dirty"
              ? "Cambios sin guardar"
              : save === "error"
                ? "No se guardó"
                : "Borrador guardado"}
        </span>
      </nav>

      {error && (
        <div role="alert" className="message error">
          {error}{" "}
          {save === "error" && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => router.refresh()}
            >
              Recargar
            </button>
          )}
        </div>
      )}

      <TotalsBar doc={doc} result={result} tone={tone} totals={totals} />

      {step === "scan" && (
        <ScanStep
          imageSrc={imageSrc}
          onManual={() => setStep("review")}
          onScanned={async (parsed, image, upload) => {
            setImageSrc(image);
            update((d) => ({
              ...d,
              merchant: parsed.merchant ?? d.merchant,
              date: parsed.date ?? d.date,
              invoiceNumber: parsed.invoiceNumber ?? d.invoiceNumber,
              printedTotalCents: parsed.printedTotalCents,
              printedTotalConfidence: parsed.printedTotalConfidence,
              items: parsed.items,
              taxes: parsed.taxes,
              charges: parsed.charges,
              allocations: [],
              ocr: parsed.ocr,
            }));
            setStep("review");
            const saved = await flush();
            if (!saved.ok) return;
            await enqueue(async () => {
              const form = new FormData();
              form.set("group_id", data.groupId);
              form.set("event_id", data.eventId);
              form.set("receipt_id", data.receiptId);
              form.set("version", String(version.current));
              form.set("image", upload);
              const uploaded = await uploadReceiptImage(form);
              if (uploaded.ok) version.current = uploaded.version;
              else
                setError(
                  `La lectura se guardó, pero la foto no: ${uploaded.error}`,
                );
            }).catch(() =>
              setError("No se pudo subir la foto. Inténtalo de nuevo."),
            );
          }}
        />
      )}

      {step === "review" && (
        <ReviewStep
          doc={doc}
          update={update}
          result={result}
          imageSrc={imageSrc}
          focusItem={focusItem}
          setFocusItem={setFocusItem}
        />
      )}

      {step === "people" && (
        <PeopleStep
          data={data}
          doc={doc}
          update={update}
          tone={tone}
          setError={setError}
        />
      )}

      {step === "assign" && (
        <AssignStep
          doc={doc}
          update={update}
          tone={tone}
          result={result}
          unassigned={unassigned.length}
        />
      )}

      {step === "pay" && (
        <PayStep
          doc={doc}
          update={update}
          totalCents={doc.printedTotalCents}
          paidCents={paidCents}
          tone={tone}
        />
      )}

      {step === "confirm" && (
        <ConfirmStep
          doc={doc}
          result={result}
          tone={tone}
          errors={errors.map((e) => e.message)}
          warnings={result.issues
            .filter((i) => i.severity === "warning")
            .map((i) => i.message)}
          paidCents={paidCents}
          onFinalize={async (confirmDuplicate) => {
            const saved = await flush();
            if (!saved.ok) return saved;
            const response = await enqueue(() =>
              finalizeReceipt({
                ...ids,
                version: version.current,
                document: latest.current,
                confirmDuplicate,
              }),
            ).catch(() => ({
              ok: false as const,
              error: "No se pudo finalizar la factura. Inténtalo de nuevo.",
            }));
            if (response.ok) {
              router.refresh();
              return null;
            }
            return response;
          }}
        />
      )}

      <div className={styles.stepNav}>
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => setStep(steps[Math.max(0, index - 1)].value)}
        >
          <ChevronLeft size={16} aria-hidden="true" /> Atrás
        </Button>
        {index < steps.length - 1 && (
          <Button type="button" onClick={() => setStep(steps[index + 1].value)}>
            Siguiente <ChevronRight size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

type Update = (change: (d: ReceiptDocument) => ReceiptDocument) => void;
type Result = ReturnType<typeof computeReceipt>;

/** Resumen siempre visible: total impreso, calculado y por persona. */
function TotalsBar({
  doc,
  result,
  tone,
  totals,
}: {
  doc: ReceiptDocument;
  result: Result;
  tone: Map<string, string>;
  totals: Map<string, number>;
}) {
  const diff = result.totals.differenceCents;
  return (
    <section className={styles.totalsBar} aria-label="Resumen de importes">
      <div className={styles.reconcile} data-ok={diff === 0 || undefined}>
        <span>
          Impreso <strong>{money(doc.printedTotalCents)}</strong>
        </span>
        <span>
          Calculado <strong>{money(result.totals.computedTotalCents)}</strong>
        </span>
        <span>
          {diff === null
            ? "Falta el total"
            : diff === 0
              ? "✓ Cuadra"
              : `Diferencia ${money(diff)}`}
        </span>
      </div>
      {doc.participants.length > 0 && (
        <ul className={styles.personTotals}>
          {doc.participants.map((p) => (
            <li key={p.id} className={styles[tone.get(p.id)!]}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(p.name)}
              </span>
              <span className={styles.personName}>{p.name}</span>
              <strong>{money(totals.get(p.id) ?? 0)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScanStep({
  imageSrc,
  onScanned,
  onManual,
}: {
  imageSrc: string | null;
  onManual: () => void;
  onScanned: (
    parsed: ReturnType<typeof parseReceiptLines> & {
      ocr: ReceiptDocument["ocr"];
    },
    image: string,
    upload: File,
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(imageSrc);
  const [file, setFile] = useState<File | null>(null);

  async function read() {
    if (!file) return;
    setFailure(null);
    try {
      setBusy("Preparando la imagen…");
      const { prepareImage, recognizeReceipt } =
        await import("../ocr/recognize");
      const { image, ocrCanvas } = await prepareImage(file);
      setBusy("Leyendo la factura en tu dispositivo…");
      const { lines, confidence } = await recognizeReceipt(
        ocrCanvas,
        (p, status) =>
          setBusy(
            status.includes("recognizing")
              ? `Leyendo la factura… ${Math.round(p * 100)} %`
              : "Preparando el lector (solo la primera vez)…",
          ),
      );
      const parsed = parseReceiptLines(lines);
      const upload = new File([image.blob], "factura.jpg", {
        type: "image/jpeg",
      });
      await onScanned(
        {
          ...parsed,
          ocr: {
            status: "done",
            confidence,
            imageWidth: image.width,
            imageHeight: image.height,
          },
        },
        image.url,
        upload,
      );
    } catch (e) {
      setFailure(
        e instanceof Error
          ? e.message
          : "No se pudo leer la factura. Puedes escribirla a mano.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`card ${styles.scan}`}>
      <h2>Toma una foto de la factura</h2>
      <p className="small muted">
        La lectura se hace en tu teléfono: la foto no se envía a ningún servicio
        externo para leerla. Pon la factura recta, sobre fondo oscuro y con
        buena luz.
      </p>
      <label className={styles.drop}>
        <Camera size={28} aria-hidden="true" />
        <span>{file ? file.name : "Tomar foto o elegir imagen"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
            setPreview(next ? URL.createObjectURL(next) : imageSrc);
          }}
        />
      </label>
      {preview && (
        <ReceiptImage src={preview} alt="Vista previa de la factura" />
      )}
      {failure && (
        <p role="alert" className="message error">
          {failure}
        </p>
      )}
      {busy && (
        <p role="status" className={styles.busy}>
          <span className="spinner" aria-hidden="true" /> {busy}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="button" disabled={!file || Boolean(busy)} onClick={read}>
          <ScanLine size={16} aria-hidden="true" /> Leer factura
        </Button>
        <Button type="button" variant="outline" onClick={onManual}>
          Escribirla a mano
        </Button>
      </div>
    </section>
  );
}

function Confidence({ value, missing }: { value?: number; missing?: boolean }) {
  if (missing)
    return (
      <span className={styles.flag} data-level="error">
        <AlertTriangle size={12} aria-hidden="true" /> Ilegible
      </span>
    );
  if (value === undefined || value >= LOW_CONFIDENCE) return null;
  return (
    <span className={styles.flag}>
      <AlertTriangle size={12} aria-hidden="true" /> Revisar
    </span>
  );
}

// Interpreta un separador final como parte de un decimal todavía en edición.
function readMoneyField(text: string) {
  return readMoney(text.replace(/^(-?\d+)[.,]$/, "$1"));
}

// Conserva el texto mientras se escribe un importe o porcentaje decimal.
function MoneyField({
  label,
  value,
  onChange,
  invalid,
  className,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (cents: number | null) => void;
  invalid?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(moneyInput(value));
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    if (readMoneyField(text) !== value) setText(moneyInput(value));
  }
  const bad = Boolean(text.trim()) && readMoneyField(text) === null;
  return (
    <label className={className ?? styles.field}>
      <span>{label}</span>
      <Input
        inputMode="decimal"
        value={text}
        aria-invalid={bad || invalid || undefined}
        placeholder="0.00"
        onChange={(e) => {
          setText(e.target.value);
          onChange(readMoneyField(e.target.value));
        }}
      />
    </label>
  );
}

function ReviewStep({
  doc,
  update,
  result,
  imageSrc,
  focusItem,
  setFocusItem,
}: {
  doc: ReceiptDocument;
  update: Update;
  result: Result;
  imageSrc: string | null;
  focusItem: string | null;
  setFocusItem: (id: string | null) => void;
}) {
  const repeated = new Set(findRepeatedItems(doc.items).flat());
  const setItem = (id: string, change: Partial<DocumentItem>) =>
    update((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.id === id ? { ...i, ...change, confidence: 1 } : i,
      ),
    }));
  const setTax = (id: string, change: Partial<DocumentTax>) =>
    update((d) => ({
      ...d,
      taxes: d.taxes.map((t) =>
        t.id === id ? { ...t, ...change, confidence: 1 } : t,
      ),
    }));
  const setCharge = (id: string, change: Partial<DocumentCharge>) =>
    update((d) => ({
      ...d,
      charges: d.charges.map((c) =>
        c.id === id ? { ...c, ...change, confidence: 1 } : c,
      ),
    }));
  const focused = doc.items.find((i) => i.id === focusItem);
  const highlights: Highlight[] = focused?.bbox
    ? [{ key: focused.id, bbox: focused.bbox, tone: "p0" }]
    : [];
  const diff = result.totals.differenceCents;
  const hasAlcohol = doc.items.some((i) => i.category === "alcoholic_beverage");
  const alcoholNote = hasAlcohol
    ? panamaTaxProfile.suggest(doc.establishment, "alcoholic_beverage")
    : null;

  return (
    <div className={styles.review}>
      {imageSrc && (
        <div className={styles.reviewImage}>
          <ReceiptImage src={imageSrc} highlights={highlights} />
        </div>
      )}
      <div className={styles.reviewForm}>
        <section className="card">
          <h2>Datos de la factura</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Comercio</span>
              <Input
                value={doc.merchant ?? ""}
                maxLength={120}
                onChange={(e) =>
                  update((d) => ({ ...d, merchant: e.target.value || null }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Fecha</span>
              <Input
                type="date"
                value={doc.date ?? ""}
                onChange={(e) =>
                  update((d) => ({ ...d, date: e.target.value || null }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Tipo de local</span>
              <select
                className="input"
                value={doc.establishment}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    establishment: e.target
                      .value as ReceiptDocument["establishment"],
                  }))
                }
              >
                {establishmentTypes.map((t) => (
                  <option key={t} value={t}>
                    {establishmentLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <MoneyField
              label="Total impreso"
              value={doc.printedTotalCents}
              invalid={doc.printedTotalCents === null}
              onChange={(cents) =>
                update((d) => ({
                  ...d,
                  printedTotalCents: cents === null ? null : Math.abs(cents),
                  printedTotalConfidence: 1,
                }))
              }
            />
          </div>
          <Confidence
            value={doc.printedTotalConfidence}
            missing={doc.printedTotalCents === null}
          />
        </section>

        <section className="card">
          <div className={styles.sectionHead}>
            <h2>Artículos</h2>
            <span className="small muted">{doc.items.length}</span>
          </div>
          {doc.items.length === 0 && (
            <p className="small muted">
              Agrega cada línea tal como aparece en la factura.
            </p>
          )}
          <ul className={styles.items}>
            {doc.items.map((item) => (
              <li
                key={item.id}
                className={styles.itemRow}
                data-focus={focusItem === item.id || undefined}
                onFocus={() => setFocusItem(item.id)}
              >
                <div className={styles.itemTop}>
                  <Input
                    aria-label="Nombre del artículo"
                    value={item.name}
                    maxLength={120}
                    onChange={(e) => setItem(item.id, { name: e.target.value })}
                  />
                  <Confidence
                    value={item.confidence}
                    missing={item.lineTotalCents === null}
                  />
                  {repeated.has(item.id) && (
                    <span className={styles.flag} data-level="info">
                      Repetido
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Quitar ${item.name}`}
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        items: d.items.filter((i) => i.id !== item.id),
                        allocations: d.allocations.filter(
                          (a) => a.itemId !== item.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.itemFields}>
                  <label className={styles.field}>
                    <span>Cant.</span>
                    <Input
                      inputMode="numeric"
                      value={String(item.quantity)}
                      onChange={(e) =>
                        setItem(item.id, {
                          quantity: Math.max(
                            1,
                            Math.min(
                              999,
                              Math.trunc(Number(e.target.value)) || 1,
                            ),
                          ),
                        })
                      }
                    />
                  </label>
                  <MoneyField
                    label="Precio unit."
                    value={item.unitPriceCents}
                    onChange={(cents) =>
                      setItem(item.id, { unitPriceCents: cents })
                    }
                  />
                  <MoneyField
                    label="Importe"
                    value={item.lineTotalCents}
                    invalid={item.lineTotalCents === null}
                    onChange={(cents) =>
                      setItem(item.id, { lineTotalCents: cents })
                    }
                  />
                  <MoneyField
                    label="Descuento"
                    value={item.discountCents ?? null}
                    onChange={(cents) =>
                      setItem(item.id, {
                        discountCents: cents === null ? 0 : Math.abs(cents),
                      })
                    }
                  />
                  <label className={styles.field}>
                    <span>Categoría</span>
                    <select
                      className="input"
                      value={item.category ?? "food"}
                      onChange={(e) =>
                        setItem(item.id, {
                          category: e.target.value as DocumentItem["category"],
                        })
                      }
                    >
                      {itemCategories.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabels[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {doc.taxes.length > 0 && (
                    <label className={styles.field}>
                      <span>Impuesto</span>
                      <select
                        className="input"
                        value={item.taxId ?? ""}
                        onChange={(e) =>
                          setItem(item.id, { taxId: e.target.value || null })
                        }
                      >
                        <option value="">Sin impuesto</option>
                        {doc.taxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update((d) => ({
                ...d,
                items: [
                  ...d.items,
                  {
                    id: newId(),
                    name: "Artículo",
                    quantity: 1,
                    unitPriceCents: null,
                    lineTotalCents: null,
                    category: "food",
                    taxId: d.taxes.length === 1 ? d.taxes[0].id : null,
                  },
                ],
              }))
            }
          >
            <Plus size={16} aria-hidden="true" /> Agregar artículo
          </Button>
        </section>

        <section className="card">
          <h2>Impuestos</h2>
          <p className="small muted">
            Se reparte lo que dice la factura, en proporción a lo que cada quien
            consumió de cada base. Si no trae impuesto, no agregues ninguno.
          </p>
          {alcoholNote?.needsConfirmation && (
            <p className="message">{alcoholNote.note}</p>
          )}
          <ul className={styles.rows}>
            {doc.taxes.map((tax) => (
              <li key={tax.id} className={styles.row}>
                <label className={styles.field}>
                  <span>Nombre</span>
                  <Input
                    value={tax.label}
                    maxLength={120}
                    onChange={(e) => setTax(tax.id, { label: e.target.value })}
                  />
                </label>
                <MoneyField
                  label="Importe"
                  value={tax.amountCents}
                  invalid={tax.amountCents === null}
                  onChange={(cents) =>
                    setTax(tax.id, {
                      amountCents: cents === null ? null : Math.abs(cents),
                    })
                  }
                />
                <label className={styles.field}>
                  <span>Aplica a</span>
                  <select
                    className="input"
                    value={tax.base}
                    onChange={(e) =>
                      setTax(tax.id, {
                        base: e.target.value as DocumentTax["base"],
                      })
                    }
                  >
                    <option value="items">Artículos marcados</option>
                    <option value="all_items">Toda la factura</option>
                  </select>
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={tax.included}
                    onChange={(e) =>
                      setTax(tax.id, { included: e.target.checked })
                    }
                  />
                  Ya incluido en los precios
                </label>
                <Confidence
                  value={tax.confidence}
                  missing={tax.amountCents === null}
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Quitar ${tax.label}`}
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      taxes: d.taxes.filter((t) => t.id !== tax.id),
                      items: d.items.map((i) =>
                        i.taxId === tax.id ? { ...i, taxId: null } : i,
                      ),
                    }))
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            {panamaTaxProfile.rates.map((rate) => (
              <Button
                key={rate.id}
                type="button"
                variant="outline"
                onClick={() =>
                  update((d) => {
                    const tax: DocumentTax = {
                      id: newId(),
                      label: rate.label,
                      rateBp: rate.rateBp,
                      amountCents: null,
                      included: false,
                      base: "items",
                    };
                    return {
                      ...d,
                      taxes: [...d.taxes, tax],
                      items: d.items.map((item) => {
                        const suggestion = panamaTaxProfile.suggest(
                          d.establishment,
                          item.category ?? "food",
                        );
                        return !item.taxId &&
                          suggestion.rateId === rate.id &&
                          !suggestion.needsConfirmation
                          ? { ...item, taxId: tax.id }
                          : item;
                      }),
                    };
                  })
                }
              >
                <Plus size={16} aria-hidden="true" /> {rate.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Propina, cargos y descuentos</h2>
          <ul className={styles.rows}>
            {doc.charges.map((charge) => (
              <li key={charge.id} className={styles.row}>
                <label className={styles.field}>
                  <span>Tipo</span>
                  <select
                    className="input"
                    value={charge.kind}
                    onChange={(e) => {
                      const kind = e.target.value as DocumentCharge["kind"];
                      const sign = kind === "discount" ? -1 : 1;
                      setCharge(charge.id, {
                        kind,
                        label: chargeLabels[kind],
                        amountCents:
                          charge.amountCents === null || kind === "adjustment"
                            ? charge.amountCents
                            : sign * Math.abs(charge.amountCents),
                        status: kind === "tip" ? charge.status : "paid",
                      });
                    }}
                  >
                    {Object.entries(chargeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <MoneyField
                  label="Importe"
                  value={
                    charge.amountCents === null || charge.kind === "adjustment"
                      ? charge.amountCents
                      : Math.abs(charge.amountCents)
                  }
                  invalid={charge.amountCents === null}
                  onChange={(cents) =>
                    setCharge(charge.id, {
                      amountCents:
                        cents === null
                          ? null
                          : charge.kind === "discount"
                            ? -Math.abs(cents)
                            : charge.kind === "adjustment"
                              ? cents
                              : Math.abs(cents),
                    })
                  }
                />
                {charge.kind === "tip" && (
                  <label className={styles.field}>
                    <span>Estado</span>
                    <select
                      className="input"
                      value={charge.status}
                      onChange={(e) =>
                        setCharge(charge.id, {
                          status: e.target.value as DocumentCharge["status"],
                        })
                      }
                    >
                      <option value="paid">Pagada (suma al total)</option>
                      <option value="suggested">
                        Solo sugerida (no se pagó)
                      </option>
                    </select>
                  </label>
                )}
                <label className={styles.field}>
                  <span>Repartir</span>
                  <select
                    className="input"
                    value={
                      charge.split.method === "equal" ? "equal" : "proportional"
                    }
                    onChange={(e) =>
                      setCharge(charge.id, {
                        split:
                          e.target.value === "equal"
                            ? { method: "equal" }
                            : { method: "proportional" },
                      })
                    }
                  >
                    <option value="proportional">
                      Según lo que consumió cada uno
                    </option>
                    <option value="equal">En partes iguales</option>
                  </select>
                </label>
                <Confidence
                  value={charge.confidence}
                  missing={charge.amountCents === null}
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Quitar ${charge.label}`}
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      charges: d.charges.filter((c) => c.id !== charge.id),
                    }))
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            {(["tip", "discount", "service_charge"] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                onClick={() =>
                  update((d) => ({
                    ...d,
                    charges: [
                      ...d.charges,
                      {
                        id: newId(),
                        label: chargeLabels[kind],
                        kind,
                        amountCents: null,
                        status: "paid",
                        split: { method: "proportional" },
                      },
                    ],
                  }))
                }
              >
                <Plus size={16} aria-hidden="true" /> {chargeLabels[kind]}
              </Button>
            ))}
          </div>
        </section>

        {diff !== null && diff !== 0 && (
          <section className={`card ${styles.mismatch}`} role="alert">
            <h2>La suma no cuadra con el total impreso</h2>
            <p>
              Calculado {money(result.totals.computedTotalCents)} · impreso{" "}
              {money(doc.printedTotalCents)} · diferencia{" "}
              <strong>{money(diff)}</strong>. Corrige los importes o registra un
              ajuste explícito.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update((d) => ({
                  ...d,
                  charges: [
                    ...d.charges,
                    {
                      id: newId(),
                      label: "Ajuste por diferencia",
                      kind: "adjustment",
                      amountCents: diff,
                      status: "paid",
                      split: { method: "proportional" },
                    },
                  ],
                }))
              }
            >
              Registrar ajuste de {money(diff)}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function PeopleStep({
  data,
  doc,
  update,
  tone,
  setError,
}: {
  data: ReceiptPageData;
  doc: ReceiptDocument;
  update: Update;
  tone: Map<string, string>;
  setError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [guests, setGuests] = useState(data.guests);
  const inDoc = (key: string) =>
    doc.participants.some(
      (p) => (p.kind === "member" ? p.userId : p.guestId) === key,
    );
  const toggleMember = (member: { id: string; name: string }) =>
    update((d) =>
      inDoc(member.id)
        ? removeParticipant(d, member.id)
        : {
            ...d,
            participants: [
              ...d.participants,
              {
                id: member.id,
                name: member.name,
                kind: "member",
                userId: member.id,
              },
            ],
          },
    );
  const toggleGuest = (guest: { id: string; name: string }) =>
    update((d) =>
      inDoc(guest.id)
        ? removeParticipant(d, guest.id)
        : {
            ...d,
            participants: [
              ...d.participants,
              {
                id: guest.id,
                name: guest.name,
                kind: "guest",
                guestId: guest.id,
              },
            ],
          },
    );

  async function addGuest(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const result = await addEventGuest({
      groupId: data.groupId,
      eventId: data.eventId,
      name,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    setName("");
    if (!guests.some((g) => g.id === result.guest.id))
      setGuests((g) => [...g, result.guest]);
    if (!inDoc(result.guest.id)) toggleGuest(result.guest);
  }

  return (
    <section className="card">
      <div className={styles.sectionHead}>
        <h2>¿Quiénes estaban?</h2>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            update((d) => ({
              ...d,
              participants: [
                ...d.participants,
                ...data.members
                  .filter((m) => !inDoc(m.id))
                  .map((m) => ({
                    id: m.id,
                    name: m.name,
                    kind: "member" as const,
                    userId: m.id,
                  })),
              ],
            }))
          }
        >
          <Users size={16} aria-hidden="true" /> Todo el grupo
        </Button>
      </div>
      <p className="small muted">
        Toca para agregar o quitar. Los invitados no necesitan cuenta.
      </p>
      <h3 className={styles.subhead}>Miembros del grupo</h3>
      <div className={styles.chips}>
        {data.members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`${styles.chip} ${styles[tone.get(m.id) ?? ""] ?? ""}`}
            aria-pressed={inDoc(m.id)}
            onClick={() => toggleMember(m)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials(m.name)}
            </span>
            {m.id === data.userId ? `${m.name} (tú)` : m.name}
          </button>
        ))}
      </div>
      <h3 className={styles.subhead}>Invitados</h3>
      <div className={styles.chips}>
        {guests.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`${styles.chip} ${styles[tone.get(g.id) ?? ""] ?? ""}`}
            aria-pressed={inDoc(g.id)}
            onClick={() => toggleGuest(g)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials(g.name)}
            </span>
            {g.name} <span className="small muted">invitado</span>
          </button>
        ))}
      </div>
      <form className={styles.inline} onSubmit={addGuest}>
        <Input
          aria-label="Nombre del invitado"
          placeholder="Nombre del invitado"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          <UserPlus size={16} aria-hidden="true" /> Agregar
        </Button>
      </form>
    </section>
  );
}

function removeParticipant(d: ReceiptDocument, id: string): ReceiptDocument {
  return {
    ...d,
    participants: d.participants.filter((p) => p.id !== id),
    payments: d.payments.filter((p) => p.participantId !== id),
    allocations: d.allocations
      .map((a): ItemAllocation | null => {
        if (a.mode === "equal") {
          const participantIds = a.participantIds.filter((p) => p !== id);
          return participantIds.length ? { ...a, participantIds } : null;
        }
        const shares = a.shares.filter((s) => s.participantId !== id);
        return shares.length ? { ...a, shares } : null;
      })
      .filter((a): a is ItemAllocation => a !== null),
  };
}

const allocatedIds = (a: ItemAllocation | undefined) =>
  !a
    ? []
    : a.mode === "equal"
      ? a.participantIds
      : a.shares.map((s) => s.participantId);

function AssignStep({
  doc,
  update,
  tone,
  result,
  unassigned,
}: {
  doc: ReceiptDocument;
  update: Update;
  tone: Map<string, string>;
  result: Result;
  unassigned: number;
}) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [custom, setCustom] = useState<string | null>(null);
  const allocation = (itemId: string) =>
    doc.allocations.find((a) => a.itemId === itemId);
  const setAllocation = (itemId: string, next: ItemAllocation | null) =>
    update((d) => ({
      ...d,
      allocations: [
        ...d.allocations.filter((a) => a.itemId !== itemId),
        ...(next ? [next] : []),
      ],
    }));
  const toggle = (itemId: string, pid: string) => {
    const current = allocation(itemId);
    if (!current || current.mode === "equal") {
      const ids = allocatedIds(current);
      const next = ids.includes(pid)
        ? ids.filter((i) => i !== pid)
        : [...ids, pid];
      return setAllocation(
        itemId,
        next.length ? { itemId, mode: "equal", participantIds: next } : null,
      );
    }
    const has = current.shares.some((s) => s.participantId === pid);
    const shares = has
      ? current.shares.filter((s) => s.participantId !== pid)
      : [...current.shares, { participantId: pid, value: 0 }];
    setAllocation(itemId, shares.length ? { ...current, shares } : null);
  };
  const lineIssues = new Map(
    result.issues.filter((i) => i.ref).map((i) => [i.ref!, i.message]),
  );
  const items = doc.items.filter((i) => !onlyPending || !allocation(i.id));

  if (doc.participants.length === 0)
    return (
      <p className="message">Primero agrega a las personas que estaban.</p>
    );

  return (
    <section className="card">
      <div className={styles.sectionHead}>
        <h2>¿Qué consumió cada quien?</h2>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          Solo pendientes ({unassigned})
        </label>
      </div>
      <p className="small muted">
        Toca a las personas que compartieron cada artículo; se divide en partes
        iguales. Usa «Dividir distinto» para unidades, porcentajes o importes.
      </p>
      {items.length === 0 && (
        <p className="message success">
          {doc.items.length
            ? "Todo está asignado."
            : "No hay artículos: agrégalos en Revisar."}
        </p>
      )}
      <ul className={styles.assignList}>
        {items.map((item) => {
          const current = allocation(item.id);
          const ids = allocatedIds(current);
          return (
            <li
              key={item.id}
              className={styles.assignItem}
              data-pending={!current || undefined}
            >
              <div className={styles.assignHead}>
                <span className={styles.itemName}>
                  {item.quantity > 1 && (
                    <span className={styles.qty}>{item.quantity}×</span>
                  )}
                  {item.name}
                </span>
                <strong>
                  {money(
                    item.lineTotalCents === null
                      ? null
                      : item.lineTotalCents - (item.discountCents ?? 0),
                  )}
                </strong>
              </div>
              <div className={styles.chips}>
                {doc.participants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.chip} ${styles.chipSmall} ${styles[tone.get(p.id)!]}`}
                    aria-pressed={ids.includes(p.id)}
                    onClick={() => toggle(item.id, p.id)}
                  >
                    <span className={styles.avatar} aria-hidden="true">
                      {initials(p.name)}
                    </span>
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() =>
                    setAllocation(item.id, {
                      itemId: item.id,
                      mode: "equal",
                      participantIds: doc.participants.map((p) => p.id),
                    })
                  }
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  aria-expanded={custom === item.id}
                  onClick={() => setCustom(custom === item.id ? null : item.id)}
                >
                  Dividir distinto
                </button>
              </div>
              {custom === item.id && (
                <CustomSplit
                  item={item}
                  allocation={current}
                  participants={doc.participants}
                  onChange={(next) => setAllocation(item.id, next)}
                />
              )}
              {lineIssues.has(item.id) && (
                <p className="small" role="alert">
                  {lineIssues.get(item.id)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CustomSplit({
  item,
  allocation,
  participants,
  onChange,
}: {
  item: DocumentItem;
  allocation: ItemAllocation | undefined;
  participants: ReceiptDocument["participants"];
  onChange: (a: ItemAllocation) => void;
}) {
  const ids = allocatedIds(allocation);
  const chosen = participants.filter((p) => ids.includes(p.id));
  const mode = allocation?.mode ?? "equal";
  const value = (pid: string) =>
    allocation && allocation.mode !== "equal"
      ? (allocation.shares.find((s) => s.participantId === pid)?.value ?? 0)
      : 0;
  const net = (item.lineTotalCents ?? 0) - (item.discountCents ?? 0);
  const setMode = (next: ItemAllocation["mode"]) =>
    onChange(
      next === "equal"
        ? { itemId: item.id, mode: "equal", participantIds: ids }
        : {
            itemId: item.id,
            mode: next,
            shares: ids.map((participantId) => ({ participantId, value: 0 })),
          },
    );
  const setValue = (pid: string, v: number) => {
    if (!allocation || allocation.mode === "equal") return;
    onChange({
      ...allocation,
      shares: allocation.shares.map((s) =>
        s.participantId === pid ? { ...s, value: v } : s,
      ),
    });
  };
  const sum =
    allocation && allocation.mode !== "equal"
      ? allocation.shares.reduce((a, s) => a + s.value, 0)
      : 0;
  const target =
    mode === "units"
      ? item.quantity
      : mode === "percent"
        ? 10_000
        : mode === "amount"
          ? net
          : 0;

  return (
    <div className={styles.custom}>
      <div
        className={styles.segmented}
        role="radiogroup"
        aria-label="Forma de dividir"
      >
        {(
          [
            ["equal", "Iguales"],
            ["units", "Unidades"],
            ["percent", "%"],
            ["amount", "Importe"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>
      {chosen.length === 0 && (
        <p className="small muted">Elige primero a las personas.</p>
      )}
      {mode !== "equal" &&
        chosen.map((p) =>
          mode === "units" ? (
            <label key={p.id} className={styles.inlineField}>
              <span>{p.name}</span>
              <Input
                inputMode="numeric"
                value={String(value(p.id))}
                onChange={(e) =>
                  setValue(
                    p.id,
                    Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                  )
                }
              />
            </label>
          ) : (
            <MoneyField
              key={`${mode}-${p.id}`}
              label={p.name}
              className={styles.inlineField}
              value={value(p.id)}
              onChange={(cents) =>
                setValue(
                  p.id,
                  Math.min(
                    mode === "percent" ? 10_000 : Number.MAX_SAFE_INTEGER,
                    Math.max(0, cents ?? 0),
                  ),
                )
              }
            />
          ),
        )}
      {mode !== "equal" && (
        <p className="small" data-ok={sum === target || undefined}>
          {mode === "units"
            ? `${sum} de ${item.quantity} unidades`
            : mode === "percent"
              ? `${sum / 100} % de 100 %`
              : `${money(sum)} de ${money(net)}`}
        </p>
      )}
    </div>
  );
}

function PayStep({
  doc,
  update,
  totalCents,
  paidCents,
  tone,
}: {
  doc: ReceiptDocument;
  update: Update;
  totalCents: number | null;
  paidCents: number;
  tone: Map<string, string>;
}) {
  const members = doc.participants.filter((p) => p.kind === "member");
  const payment = (pid: string) =>
    doc.payments.find((p) => p.participantId === pid);
  const setPayment = (
    pid: string,
    change: Partial<ReceiptDocument["payments"][number]> | null,
  ) =>
    update((d) => {
      const others = d.payments.filter((p) => p.participantId !== pid);
      if (!change) return { ...d, payments: others };
      const current = d.payments.find((p) => p.participantId === pid) ?? {
        participantId: pid,
        cents: 0,
        method: "card" as const,
      };
      return { ...d, payments: [...others, { ...current, ...change }] };
    });

  return (
    <section className="card">
      <h2>¿Quién pagó?</h2>
      <p className="small muted">
        Pueden ser una o varias personas del grupo. Los invitados no registran
        pagos. Total de la factura: <strong>{money(totalCents)}</strong>.
      </p>
      <ul className={styles.rows}>
        {members.map((p) => {
          const current = payment(p.id);
          return (
            <li
              key={p.id}
              className={`${styles.payRow} ${styles[tone.get(p.id)!]}`}
            >
              <span className={styles.payName}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(p.name)}
                </span>
                {p.name}
              </span>
              <MoneyField
                label="Pagó"
                value={current?.cents ?? null}
                onChange={(cents) =>
                  setPayment(p.id, cents && cents > 0 ? { cents } : null)
                }
              />
              <label className={styles.field}>
                <span>Medio</span>
                <select
                  className="input"
                  value={current?.method ?? "card"}
                  disabled={!current}
                  onChange={(e) =>
                    setPayment(p.id, {
                      method: e.target.value as (typeof paymentMethods)[number],
                    })
                  }
                >
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {methodLabels[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Nota</span>
                <Input
                  value={current?.note ?? ""}
                  maxLength={200}
                  disabled={!current}
                  onChange={(e) =>
                    setPayment(p.id, { note: e.target.value || undefined })
                  }
                />
              </label>
              {totalCents !== null && totalCents > 0 && (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      payments: [
                        {
                          participantId: p.id,
                          cents: totalCents,
                          method: current?.method ?? "card",
                        },
                      ],
                    }))
                  }
                >
                  Pagó todo
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p
        className={`message ${totalCents !== null && paidCents === totalCents ? "success" : ""}`}
        role="status"
      >
        Pagos registrados: {money(paidCents)} de {money(totalCents)}
        {totalCents !== null && paidCents !== totalCents
          ? ` · faltan ${money(totalCents - paidCents)}`
          : ""}
      </p>
    </section>
  );
}

function ConfirmStep({
  doc,
  result,
  tone,
  errors,
  warnings,
  paidCents,
  onFinalize,
}: {
  doc: ReceiptDocument;
  result: Result;
  tone: Map<string, string>;
  errors: string[];
  warnings: string[];
  paidCents: number;
  onFinalize: (
    confirmDuplicate: boolean,
  ) => Promise<{ ok: false; error: string; duplicate?: true } | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    error: string;
    duplicate?: true;
  } | null>(null);
  const settlement =
    result.canFinalize && doc.payments.length
      ? computeSettlement(
          doc.participants.map((p) => p.id),
          new Map(result.people.map((p) => [p.participantId, p.totalCents])),
          doc.payments,
        )
      : null;
  const payIssue =
    doc.payments.length === 0
      ? "Indica quién pagó la factura."
      : doc.printedTotalCents !== null && paidCents !== doc.printedTotalCents
        ? `Los pagos (${money(paidCents)}) no suman el total (${money(doc.printedTotalCents)}).`
        : null;
  const blocking = [...errors, ...(payIssue ? [payIssue] : [])];
  const names = new Map(doc.participants.map((p) => [p.id, p.name]));

  async function submit(confirmDuplicate: boolean) {
    setBusy(true);
    setFailure(null);
    const response = await onFinalize(confirmDuplicate);
    setBusy(false);
    if (response) setFailure(response);
  }

  return (
    <section className="card">
      <h2>Confirmar el reparto</h2>
      {blocking.length > 0 ? (
        <div className="message error" role="alert">
          <p>Falta resolver antes de finalizar:</p>
          <ul>
            {blocking.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="message success">
          Todo cuadra al centavo con la factura.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="small muted">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <ul className={styles.personCards}>
        {result.people.map((p) => (
          <li
            key={p.participantId}
            className={styles[tone.get(p.participantId)!]}
          >
            <div className={styles.personHead}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(names.get(p.participantId) ?? "")}
              </span>
              <strong>{names.get(p.participantId)}</strong>
              <strong className={styles.personTotal}>
                {money(p.totalCents)}
              </strong>
            </div>
            <dl className={styles.breakdown}>
              <dt>Consumo</dt>
              <dd>{money(p.itemsCents + p.discountsCents)}</dd>
              <dt>Impuestos</dt>
              <dd>{money(p.taxCents)}</dd>
              <dt>Propina y cargos</dt>
              <dd>{money(p.tipCents + p.chargesCents + p.adjustmentsCents)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      {settlement?.ok && settlement.transfers.length > 0 && (
        <>
          <h3 className={styles.subhead}>Para quedar a mano</h3>
          <ul className={styles.transfers}>
            {settlement.transfers.map((t) => (
              <li key={`${t.fromId}-${t.toId}`}>
                {names.get(t.fromId)} → {names.get(t.toId)}:{" "}
                <strong>{money(t.cents)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      <details className={styles.details}>
        <summary>Detalle del cálculo</summary>
        <p className="small muted">
          Importes en centavos exactos. Cada artículo compartido se divide por
          el método del resto mayor: los centavos sobrantes van a quien tiene la
          mayor fracción y, en empate, al primero de la lista. Impuestos y
          propina se reparten en proporción al consumo de su base.
        </p>
        <dl className={styles.breakdown}>
          <dt>Artículos</dt>
          <dd>{money(result.totals.itemsCents)}</dd>
          <dt>Descuentos</dt>
          <dd>{money(result.totals.discountsCents)}</dd>
          <dt>Impuestos agregados</dt>
          <dd>{money(result.totals.addedTaxCents)}</dd>
          <dt>Propina pagada</dt>
          <dd>{money(result.totals.tipCents)}</dd>
          <dt>Propina sugerida (no suma)</dt>
          <dd>{money(result.totals.suggestedTipCents)}</dd>
          <dt>Cargos y ajustes</dt>
          <dd>
            {money(result.totals.chargesCents + result.totals.adjustmentsCents)}
          </dd>
          <dt>Total</dt>
          <dd>{money(result.totals.computedTotalCents)}</dd>
        </dl>
      </details>
      {failure && (
        <div role="alert" className="message error">
          {failure.error}
          {failure.duplicate && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => submit(true)}
            >
              No está repetida, finalizar
            </Button>
          )}
        </div>
      )}
      <Button
        type="button"
        disabled={busy || blocking.length > 0}
        onClick={() => submit(false)}
      >
        {busy ? "Finalizando…" : "Finalizar y registrar gastos"}
      </Button>
      <p className="small muted">
        Se crearán los gastos de la salida y las deudas de cada persona. Podrás
        corregir la factura mientras nadie marque un pago como saldado.
      </p>
    </section>
  );
}
