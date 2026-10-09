import { LIMITS } from "./types";

/**
 * Shrinks a camera photo into a JPEG data URL that fits a Firestore document
 * (~100–250 KB instead of a 4 MB phone photo).
 */
export async function compressImage(file: File, maxEdge = 1100): Promise<string> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported on this device.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  // Step the quality down until it fits comfortably under the document limit.
  for (const quality of [0.74, 0.62, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < LIMITS.photoChars * 0.8) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.3);
}

type Drawable = { width: number; height: number };

async function loadBitmap(file: File): Promise<Drawable & CanvasImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      // 'from-image' applies the EXIF rotation phones store selfies with.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The image is fully decoded by now.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
