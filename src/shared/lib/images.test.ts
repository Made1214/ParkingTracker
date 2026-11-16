import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  imageTypeFromBytes,
  imageValidationError,
} from "./images";

const webp = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
];
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const file = (bytes: number[], type: string) =>
  new File([new Uint8Array(bytes)], "a", { type });

describe("imageTypeFromBytes", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", () => {
    expect(imageTypeFromBytes(new Uint8Array(jpeg))).toBe("image/jpeg");
    expect(imageTypeFromBytes(new Uint8Array(png))).toBe("image/png");
    expect(imageTypeFromBytes(new Uint8Array(webp))).toBe("image/webp");
  });

  it("rechaza RIFF que no es WebP, texto y vacío", () => {
    const wav = [...webp];
    wav.splice(8, 4, 0x57, 0x41, 0x56, 0x45);
    expect(imageTypeFromBytes(new Uint8Array(wav))).toBeNull();
    expect(imageTypeFromBytes(new TextEncoder().encode("<svg/>"))).toBeNull();
    expect(imageTypeFromBytes(new Uint8Array())).toBeNull();
  });
});

describe("imageValidationError", () => {
  it("acepta una imagen cuyo contenido coincide con su tipo", async () => {
    expect(
      await imageValidationError(file(webp, "image/webp")),
    ).toBeUndefined();
    expect(await imageValidationError(file(png, "image/png"))).toBeUndefined();
  });

  it("rechaza un archivo que declara ser imagen pero no lo es", async () => {
    expect(
      await imageValidationError(file([0x3c, 0x73, 0x76], "image/png")),
    ).toMatch(/no parece una imagen/);
  });

  it("rechaza un tipo declarado distinto del real", async () => {
    expect(await imageValidationError(file(png, "image/jpeg"))).toMatch(
      /no parece una imagen/,
    );
  });

  it("rechaza vacíos, tipos no admitidos y archivos grandes", async () => {
    expect(await imageValidationError(file([], "image/png"))).toBe(
      "Selecciona una imagen.",
    );
    expect(await imageValidationError(file(png, "image/gif"))).toBe(
      "Usa una imagen JPG, PNG o WebP.",
    );
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "b", {
      type: "image/png",
    });
    expect(await imageValidationError(big)).toMatch(/5 MB/);
  });
});
