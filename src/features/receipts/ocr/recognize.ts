import type { OcrLine } from "../lib/ocr-parse";
import type { Worker } from "tesseract.js";

/**
 * OCR en el navegador con Tesseract.js (Apache-2.0, gratis). La imagen de la
 * factura NUNCA sale del dispositivo para leerla: solo se descargan, una vez,
 * el motor y el modelo de idioma (archivos estáticos públicos).
 *
 * Se lee la misma imagen que luego se sube, así las coordenadas de cada línea
 * (normalizadas a 0..1) sirven para resaltar artículos sobre el original.
 */

/** Lado mayor máximo: suficiente para leer facturas térmicas largas. */
const MAX_SIDE = 2400;

export type PreparedImage = {
  /** JPEG listo para subir (≤ 5 MB) y mostrar. */
  blob: Blob;
  width: number;
  height: number;
  url: string;
};

/**
 * Decodifica (incluido HEIC en los navegadores que lo soportan), reduce el
 * tamaño y normaliza el contraste para el OCR. Devuelve la versión en color
 * para guardar y un lienzo en grises para leer.
 */
export async function prepareImage(
  file: File,
): Promise<{ image: PreparedImage; ocrCanvas: HTMLCanvasElement }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "No se pudo abrir la imagen. Usa una foto JPG o PNG (en algunos navegadores HEIC no está disponible).",
    );
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const color = document.createElement("canvas");
  color.width = width;
  color.height = height;
  color.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob = await toJpeg(color, quality);
  while (blob.size > 4.5 * 1024 * 1024 && quality > 0.4) {
    quality -= 0.15;
    blob = await toJpeg(color, quality);
  }

  const gray = document.createElement("canvas");
  gray.width = width;
  gray.height = height;
  const ctx = gray.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(color, 0, 0);
  const data = ctx.getImageData(0, 0, width, height);
  enhance(data.data);
  ctx.putImageData(data, 0, 0);

  return {
    image: { blob, width, height, url: URL.createObjectURL(blob) },
    ocrCanvas: gray,
  };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("No se pudo preparar la imagen.")),
      "image/jpeg",
      quality,
    ),
  );
}

/**
 * Escala de grises + estiramiento de contraste (percentiles 2–98): ayuda con
 * papel térmico desvaído e iluminación irregular sin binarizar en exceso.
 */
function enhance(px: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = y;
    hist[y]++;
  }
  const total = px.length / 4;
  let low = 0;
  let high = 255;
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      low = v;
      break;
    }
  }
  for (let acc = 0, v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      high = v;
      break;
    }
  }
  const range = Math.max(1, high - low);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - low) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
}

type Progress = (progress: number, status: string) => void;
type Reader = {
  worker: Promise<Worker>;
  progress?: Progress;
  expiry?: ReturnType<typeof setTimeout>;
  busy: boolean;
};
let cachedReader: Reader | undefined;

/** Inicializa un lector reutilizable con el motor y los modelos del navegador. */
function createReader(): Reader {
  const reader: Reader = {
    busy: false,
    worker: import("tesseract.js").then(async ({ createWorker, PSM }) => {
      const worker = await createWorker("spa+eng", 1, {
        logger: (m) => reader.progress?.(m.progress ?? 0, m.status ?? ""),
      });
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          preserve_interword_spaces: "1",
        });
        return worker;
      } catch (error) {
        await worker.terminate();
        throw error;
      }
    }),
  };
  return reader;
}

/** Libera el motor incluso si todavía se están descargando sus modelos. */
function releaseReader(reader: Reader) {
  if (cachedReader === reader) cachedReader = undefined;
  clearTimeout(reader.expiry);
  void reader.worker
    .then((worker) => worker.terminate())
    .catch(() => undefined);
}

/** Ejecuta la lectura local y permite interrumpirla durante la preparación o el OCR. */
export async function recognizeReceipt(
  canvas: HTMLCanvasElement,
  onProgress?: Progress,
  signal?: AbortSignal,
): Promise<{ lines: OcrLine[]; confidence: number }> {
  signal?.throwIfAborted();
  const reader =
    cachedReader && !cachedReader.busy ? cachedReader : createReader();
  cachedReader = reader;
  clearTimeout(reader.expiry);
  reader.busy = true;
  reader.progress = onProgress;
  let abort: (() => void) | undefined;
  let completed = false;
  const cancellation = new Promise<never>((_, reject) => {
    abort = () => reject(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
  });
  try {
    const worker = await Promise.race([reader.worker, cancellation]);
    const { data } = await Promise.race([
      worker.recognize(canvas, {}, { blocks: true }),
      cancellation,
    ]);
    const { width, height } = canvas;
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.map((line) => ({
          text: line.text.replace(/\s+$/, ""),
          confidence: Math.max(0, Math.min(1, line.confidence / 100)),
          bbox: {
            x: clamp(line.bbox.x0 / width),
            y: clamp(line.bbox.y0 / height),
            w: clamp((line.bbox.x1 - line.bbox.x0) / width),
            h: clamp((line.bbox.y1 - line.bbox.y0) / height),
          },
        })),
      ),
    );
    completed = true;
    return {
      lines,
      confidence: Math.max(0, Math.min(1, data.confidence / 100)),
    };
  } finally {
    if (abort) signal?.removeEventListener("abort", abort);
    reader.busy = false;
    reader.progress = undefined;
    if (completed && cachedReader === reader)
      reader.expiry = setTimeout(() => releaseReader(reader), 45_000);
    else releaseReader(reader);
  }
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
