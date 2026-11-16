/**
 * Límites de tamaño de imágenes, en un solo lugar (issue #54):
 *
 * - `MAX_IMAGE_BYTES` (5 MB): avatares y portadas, que viajan por una server
 *   action. `serverActions.bodySizeLimit` (6 MB, next.config.ts) deja margen
 *   para el resto del formulario; si se sube uno, hay que subir el otro.
 * - `MAX_PHOTO_BYTES` (10 MB): fotos de la galería (RF-901). Se reducen en el
 *   navegador y suben directo a Cloudinary; la base de datos también lo exige
 *   con un CHECK.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Tipo real de la imagen según sus primeros bytes, o `null` si no es JPEG, PNG
 * ni WebP. `file.type` lo declara el navegador y se puede falsear.
 */
export function imageTypeFromBytes(
  bytes: Uint8Array,
): (typeof IMAGE_TYPES)[number] | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, i) => bytes[offset + i] === byte);
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  // "RIFF" + tamaño de 4 bytes + "WEBP".
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  )
    return "image/webp";
  return null;
}

export async function imageValidationError(file: File) {
  if (!file.size) return "Selecciona una imagen.";
  if (file.size > MAX_IMAGE_BYTES)
    return "La imagen debe pesar como máximo 5 MB.";
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Usa una imagen JPG, PNG o WebP.";
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (imageTypeFromBytes(head) !== file.type)
    return "El archivo no parece una imagen JPG, PNG o WebP.";
}
