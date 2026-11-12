"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, ImagePlus, Images, X } from "lucide-react";
import type { ActionState } from "@/shared/lib/forms";
import { ActionForm } from "@/shared/ui/action-form";
import { dateLabel } from "@/shared/lib/utils";
import { swipeStep } from "../lib/swipe";
import styles from "./gallery.module.css";

type Photo = {
  id: string;
  author: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  canDelete: boolean;
};
type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1600;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Reduce la imagen en el navegador antes de subirla (RF-904). */
async function compress(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export function PhotoGallery({
  groupId,
  eventId,
  photos,
  canUpload,
  uploadAction,
  deleteAction,
}: {
  groupId: string;
  eventId: string;
  photos: Photo[];
  canUpload: boolean;
  uploadAction: Action;
  deleteAction: Action;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const direction = useRef(0);
  const [openId, setOpenId] = useState<string | null>(null);
  // Inicio del gesto de deslizar en el visor (E9.F2.T1).
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const index = photos.findIndex((photo) => photo.id === openId);
  const current = index >= 0 ? photos[index] : null;
  const src = (id: string) =>
    `/api/groups/${groupId}/events/${eventId}/photos/${id}`;

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Desplazamiento y escala que dejan el visor encima de la miniatura. */
  function overThumbnail(id: string) {
    const element = dialog.current;
    const thumbnail = grid.current?.querySelector(`[data-photo="${id}"]`);
    if (!element || !thumbnail) return { scale: 0.94 };
    const from = thumbnail.getBoundingClientRect();
    const to = element.getBoundingClientRect();
    return {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: Math.max(0.1, from.width / Math.max(1, to.width)),
    };
  }

  // Al abrir, la foto crece desde su miniatura; al cerrar, vuelve a ella.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (current && !element.open) {
      element.showModal();
      if (reducedMotion()) return;
      const image = element.querySelector("img");
      const grow = () =>
        gsap.fromTo(
          element,
          { ...overThumbnail(current.id), opacity: 0 },
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.45,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
        );
      if (!image || image.complete) grow();
      else {
        // Sin la foto cargada no se conoce el tamaño final del visor.
        gsap.set(element, { opacity: 0 });
        image.addEventListener("load", grow, { once: true });
        image.addEventListener(
          "error",
          () => gsap.set(element, { clearProps: "opacity" }),
          { once: true },
        );
      }
    }
    if (!current && element.open) {
      element.close();
      gsap.killTweensOf(element);
      gsap.set(element, { clearProps: "transform,opacity" });
      element.removeAttribute("data-closing");
    }
  }, [current]);

  // Al pasar de foto, la nueva entra desde el lado hacia el que se avanza.
  useLayoutEffect(() => {
    const image = dialog.current?.querySelector("img");
    const delta = direction.current;
    direction.current = 0;
    if (!image || !delta || reducedMotion()) return;
    gsap.fromTo(
      image,
      { x: 36 * delta, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.32,
        ease: "power3.out",
        clearProps: "transform,opacity",
      },
    );
  }, [openId]);

  function close() {
    const element = dialog.current;
    if (!element || !current || reducedMotion()) return setOpenId(null);
    if (element.hasAttribute("data-closing")) return;
    gsap.killTweensOf(element);
    gsap.set(element, { clearProps: "transform,opacity" });
    element.setAttribute("data-closing", "");
    gsap.to(element, {
      ...overThumbnail(current.id),
      opacity: 0,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => setOpenId(null),
    });
  }

  function upload(files: File[]) {
    if (!files.length) return;
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    startTransition(async () => {
      const failed: string[] = [];
      for (const [position, original] of files.entries()) {
        if (!TYPES.includes(original.type))
          failed.push(`${original.name}: usa JPG, PNG o WebP.`);
        else if (original.size > MAX_ORIGINAL_BYTES)
          failed.push(`${original.name}: supera los 10 MB.`);
        else {
          const data = new FormData();
          data.set("group_id", groupId);
          data.set("event_id", eventId);
          data.set("photo", await compress(original));
          try {
            const result = await uploadAction({}, data);
            if (result.error) failed.push(`${original.name}: ${result.error}`);
          } catch {
            failed.push(`${original.name}: no se pudo subir.`);
          }
        }
        setProgress({ done: position + 1, total: files.length });
      }
      setErrors(failed);
      setProgress(undefined);
      if (input.current) input.current.value = "";
    });
  }

  const step = (delta: number) => {
    direction.current = delta;
    setOpenId(photos[(index + delta + photos.length) % photos.length].id);
  };

  return (
    <>
      {canUpload && (
        <div
          className={styles.dropzone}
          data-busy={progress ? true : undefined}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!progress) upload([...event.dataTransfer.files]);
          }}
        >
          <span className="tile-icon" aria-hidden="true">
            <ImagePlus size={20} />
          </span>
          <div>
            <strong>
              {progress
                ? `Subiendo ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
                : "Suma tus fotos a la salida"}
            </strong>
            <p className="small muted">
              Arrástralas aquí o elígelas. JPG, PNG o WebP de hasta 10 MB; se
              optimizan antes de subir.
            </p>
            {progress && (
              <span className={styles.bar} aria-hidden="true">
                <span
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </span>
            )}
          </div>
          <button
            type="button"
            className="button"
            disabled={Boolean(progress)}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={17} aria-hidden="true" /> Subir fotos
          </button>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept={TYPES.join(",")}
            multiple
            tabIndex={-1}
            aria-label="Elegir fotos"
            onChange={(event) => upload([...(event.target.files ?? [])])}
          />
        </div>
      )}
      <div role="status" aria-live="polite">
        {errors.length > 0 && (
          <ul className={`message error ${styles.errors}`}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      {photos.length ? (
        <ul ref={grid} className={`${styles.grid} stagger`}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                data-photo={photo.id}
                onClick={() => setOpenId(photo.id)}
                aria-label={`Ver foto de ${photo.author}`}
              >
                {/* Activos privados: se sirven por la ruta que verifica membresía. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src(photo.id)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
                <span className={styles.caption}>{photo.author}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <Images size={30} aria-hidden="true" />
          <h3>Los recuerdos de esta salida irán aquí</h3>
          <p className="small muted">
            {canUpload
              ? "Sube la primera foto y deja que el resto se anime."
              : "Esta salida no tiene fotos."}
          </p>
        </div>
      )}

      <dialog
        ref={dialog}
        className={styles.lightbox}
        aria-label="Foto ampliada"
        onClose={() => setOpenId(null)}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        onKeyDown={(event) => {
          if (photos.length < 2) return;
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {current && (
          <figure
            onPointerDown={(event) => {
              swipeStart.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (!start || photos.length < 2) return;
              const direction = swipeStep(
                event.clientX - start.x,
                event.clientY - start.y,
              );
              if (direction) step(direction);
            }}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={src(current.id)}
              alt={`Foto de ${current.author}`}
            />
            <figcaption>
              <span>
                <strong>{current.author}</strong>
                <small>{dateLabel(current.createdAt)}</small>
              </span>
              {current.canDelete && (
                <ActionForm
                  key={current.id}
                  action={deleteAction}
                  label="Eliminar"
                  tone="danger"
                  className={styles.deleteForm}
                >
                  <input type="hidden" name="group_id" value={groupId} />
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="id" value={current.id} />
                </ActionForm>
              )}
            </figcaption>
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className={styles.prev}
                  onClick={() => step(-1)}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  className={styles.next}
                  onClick={() => step(1)}
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </figure>
        )}
      </dialog>
    </>
  );
}
