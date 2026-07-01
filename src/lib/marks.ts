import "server-only";
import sharp from "sharp";

export type MarkMap = Record<number, { x: number; y: number }>; // id -> center in %

/** Minimal shape needed to draw a numbered mark. MeasuredElement and
 *  IR-derived boxes both satisfy it. */
export type MarkInput = { id: number; x: number; y: number; w: number; h: number };

/**
 * Set-of-Marks: draw numbered boxes over the detected elements and return the
 * marked image (data URL) for the model, plus a map from mark id to the
 * element's centre in % (for placing annotations in the UI).
 */
export async function buildMarks(
  buffer: Buffer,
  width: number,
  height: number,
  elements: MarkInput[],
): Promise<{ dataUrl: string; map: MarkMap }> {
  const map: MarkMap = {};
  const parts: string[] = [];

  for (const el of elements) {
    map[el.id] = {
      x: Math.round(((el.x + el.w / 2) / width) * 1000) / 10,
      y: Math.round(((el.y + el.h / 2) / height) * 1000) / 10,
    };
    const badge = Math.max(20, Math.min(34, el.h * 0.7));
    const bx = el.x;
    const by = Math.max(0, el.y - badge * 0.4);
    parts.push(
      `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="6" ` +
        `fill="none" stroke="#ff3b6b" stroke-width="2" opacity="0.85"/>` +
        `<circle cx="${bx}" cy="${by}" r="${badge / 2}" fill="#ff3b6b"/>` +
        `<text x="${bx}" y="${by}" font-family="Arial" font-size="${badge * 0.62}" ` +
        `font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${el.id}</text>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`;
  const out = await sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return { dataUrl: `data:image/png;base64,${out.toString("base64")}`, map };
}
