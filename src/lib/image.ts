export type ImageInfo = {
  kind: "data" | "url" | "unknown";
  mime?: string;
  kb?: number;
  /** Whether a vision model can actually parse this (raster formats only). */
  isRaster: boolean;
};

const RASTER = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

/** Inspect an image string (data URL or remote URL) so we can verify what we
 *  are actually sending to the model. Vision models can't parse SVG. */
export function inspectImage(image: string): ImageInfo {
  if (image.startsWith("data:")) {
    const m = image.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
    if (!m) return { kind: "data", isRaster: false };
    const mime = m[1].toLowerCase();
    const isB64 = Boolean(m[2]);
    const data = m[3] ?? "";
    const bytes = isB64 ? Math.floor(data.length * 0.75) : decodeURIComponent(data).length;
    return { kind: "data", mime, kb: Math.round(bytes / 1024), isRaster: RASTER.includes(mime) };
  }
  if (/^https?:\/\//.test(image)) return { kind: "url", isRaster: true };
  return { kind: "unknown", isRaster: false };
}

export const NOT_RASTER_MESSAGE =
  "That image is a vector/SVG, which vision models can't read. Upload a PNG, JPG, or WEBP screenshot.";
