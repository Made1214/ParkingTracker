export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageValidationError(file: File) {
  if (!file.size) return "Selecciona una imagen.";
  if (file.size > MAX_IMAGE_BYTES)
    return "La imagen debe pesar como máximo 5 MB.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Usa una imagen JPG, PNG o WebP.";
}
