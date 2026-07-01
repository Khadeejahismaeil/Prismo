import "server-only";
import { makeIR, type DesignNode, type IR } from "./ir";
import { fgBg, rawPixels, type Box } from "./measure";
import { toHex } from "./wcag";

/**
 * Raster → IR. A vision "detection" pass returns the real elements with boxes
 * (replacing OCR); we build an IR from them and measure fg/bg contrast from the
 * ACTUAL pixels in each box. Non-uniform backgrounds (gradients, images behind
 * text) are marked indeterminate rather than given a fabricated contrast — the
 * same honesty as the HTML/Figma pipelines.
 */

/** One detected element. Box is [ymin, xmin, ymax, xmax] normalised to 0–1000
 *  (Gemini's bounding-box convention). */
export type Detection = {
  role?: string;
  text?: string;
  box: [number, number, number, number];
};

const ROLES = new Set(["heading", "text", "button", "image", "input", "icon", "container", "link", "logo"]);

/** Convert detection boxes into an IR tree (one container root + flat children). */
export function buildRasterIR(dets: Detection[], W: number, H: number): IR {
  let i = 0;
  const children: DesignNode[] = [];
  for (const d of dets) {
    if (!Array.isArray(d.box) || d.box.length !== 4) continue;
    const [ymin, xmin, ymax, xmax] = d.box;
    const x = Math.round((Math.min(xmin, xmax) / 1000) * W);
    const y = Math.round((Math.min(ymin, ymax) / 1000) * H);
    const w = Math.round((Math.abs(xmax - xmin) / 1000) * W);
    const h = Math.round((Math.abs(ymax - ymin) / 1000) * H);
    if (w < 2 || h < 2 || w > W * 1.02 || h > H * 1.02) continue; // drop junk / whole-image boxes
    const text = (d.text ?? "").trim().slice(0, 120) || undefined;
    const role = d.role && ROLES.has(d.role) ? d.role : text ? "text" : "container";
    children.push({
      id: `n${++i}`,
      role,
      tag: role,
      ...(text ? { text } : {}),
      bbox: { x, y, w, h },
      color: { rgb: null },
      bg: { rgb: null },
      // Box height is a solid proxy for type size (used for hierarchy + large-text AA).
      ...(text ? { fontPx: h } : {}),
      children: [],
    });
  }
  const root: DesignNode = {
    id: "n0",
    role: "container",
    tag: "image",
    bbox: { x: 0, y: 0, w: W, h: H },
    color: { rgb: null },
    bg: { rgb: null },
    children,
  };
  return makeIR("raster", { w: W, h: H }, root);
}

/** Non-uniform background threshold: below this dominant-colour share, we can't
 *  trust a single contrast number. */
const UNIFORM_MIN = 0.5;

/** Populate each text node's colour/bg by sampling the real pixels in its box. */
export async function measureRasterColors(buffer: Buffer, ir: IR): Promise<void> {
  const { raw, W, H, ch } = await rawPixels(buffer);
  for (const node of Object.values(ir.flat)) {
    if (!node.text) continue;
    const box: Box = {
      x0: Math.max(0, Math.min(W - 1, node.bbox.x)),
      y0: Math.max(0, Math.min(H - 1, node.bbox.y)),
      x1: Math.max(1, Math.min(W, node.bbox.x + node.bbox.w)),
      y1: Math.max(1, Math.min(H, node.bbox.y + node.bbox.h)),
    };
    if (box.x1 - box.x0 < 2 || box.y1 - box.y0 < 2) {
      node.color = { rgb: null, indeterminate: true };
      node.bg = { rgb: null, indeterminate: true };
      continue;
    }
    const { fg, bg, bgShare } = fgBg(raw, W, ch, box);
    if (bgShare < UNIFORM_MIN) {
      // Text sits on a gradient/image — real contrast is ambiguous.
      node.color = { rgb: fg, raw: toHex(fg), indeterminate: true };
      node.bg = { rgb: bg, raw: "non-uniform", indeterminate: true };
    } else {
      node.color = { rgb: fg, raw: toHex(fg) };
      node.bg = { rgb: bg, raw: toHex(bg) };
    }
  }
}
