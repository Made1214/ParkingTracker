import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export function mediaConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function client() {
  if (!mediaConfigured()) throw new Error("Media is not configured");
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export async function uploadPrivateImage(file: File, publicId: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const api = client();
  return new Promise<UploadApiResponse>((resolve, reject) => {
    api.uploader
      .upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          type: "authenticated",
          overwrite: false,
          format: "webp",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation: [
            { width: 1600, height: 900, crop: "limit", quality: "auto" },
          ],
          timeout: 30000,
        },
        (error, result) => {
          if (error || !result) reject(new Error("Image upload failed"));
          else resolve(result);
        },
      )
      .end(buffer);
  });
}

export function privateImageUrl(publicId: string) {
  return client().utils.private_download_url(publicId, "webp", {
    type: "authenticated",
    resource_type: "image",
    expires_at: Math.floor(Date.now() / 1000) + 60,
    attachment: false,
  });
}

export async function deletePrivateImage(publicId: string) {
  await client().uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });
}
