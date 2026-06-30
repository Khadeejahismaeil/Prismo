import "server-only";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";

export type RGB = [number, number, number];

export type MeasuredElement = {
  id: number;
  text: string;
  x: number; // px, top-left
  y: number;
  w: number;
  h: number;
  fontPx: number;
  fg: RGB;
  bg: RGB;
  contrast: number; // 1..21
  aa: boolean; // normal-text AA (>=4.5)
  aaLarge: boolean; // large-text AA (>=3.0)
};

export type Measurements = {
  width: number;
  height: number;
  elements: MeasuredElement[];
  palette: { hex: string; pct: number }[];
  contrastFailRate: number; // 0..1 of text elements failing AA
};

/* ---------- WCAG contrast ---------- */
function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: RGB) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a: RGB, b: RGB) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
export function toHex([r, g, b]: RGB) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
const dist = (a: RGB, b: RGB) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/* ---------- OCR worker (singleton, serialized) ---------- */
let workerP: Promise<Worker> | null = null;
let lock: Promise<unknown> = Promise.resolve();

async function ocr(buffer: Buffer) {
  workerP ??= createWorker("eng");
  const worker = await workerP;
  const run = lock.then(() => worker.recognize(buffer, {}, { blocks: true }));
  lock = run.catch(() => {});
  return run;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type Line = { text: string; bbox: Box };

function linesFrom(data: { blocks?: unknown }): Line[] {
  const out: Line[] = [];
  const blocks = (data.blocks ?? []) as Array<{
    paragraphs?: Array<{ lines?: Array<{ text?: string; bbox?: Box }> }>;
  }>;
  for (const b of blocks)
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? [])
        if (l.bbox && (l.text ?? "").trim()) out.push({ text: l.text!.trim(), bbox: l.bbox });
  return out;
}

/* ---------- foreground/background extraction in a region ---------- */
function fgBg(raw: Buffer, W: number, ch: number, box: Box): { fg: RGB; bg: RGB } {
  const q = (v: number) => Math.min(255, Math.round(v / 16) * 16); // quantize to cut anti-alias noise
  const counts = new Map<string, { c: number; rgb: RGB }>();
  const step = Math.max(1, Math.floor((box.x1 - box.x0) / 120));
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += step) {
      const i = (y * W + x) * ch;
      const rgb: RGB = [q(raw[i]), q(raw[i + 1]), q(raw[i + 2])];
      const key = rgb.join(",");
      const e = counts.get(key);
      if (e) e.c++;
      else counts.set(key, { c: 1, rgb });
    }
  }
  const sorted = [...counts.values()].sort((a, b) => b.c - a.c);
  const bg = sorted[0]?.rgb ?? [255, 255, 255];
  const total = sorted.reduce((s, e) => s + e.c, 0) || 1;
  // foreground = the colour most different from bg with a meaningful share (the ink)
  let fg = bg;
  let best = -1;
  for (const e of sorted) {
    if (e.c / total < 0.01) continue;
    const d = dist(e.rgb, bg);
    if (d > best) {
      best = d;
      fg = e.rgb;
    }
  }
  return { fg, bg };
}

async function palette(buffer: Buffer): Promise<{ hex: string; pct: number }[]> {
  const { data, info } = await sharp(buffer)
    .resize(48, 48, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const q = (v: number) => Math.min(255, Math.round(v / 24) * 24);
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += info.channels) {
    const key = [q(data[i]), q(data[i + 1]), q(data[i + 2])].join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = info.width * info.height;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, c]) => ({
      hex: toHex(k.split(",").map(Number) as RGB),
      pct: Math.round((c / total) * 100),
    }));
}

export async function measureDesign(buffer: Buffer): Promise<Measurements> {
  const { data: raw, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ch = info.channels;

  // OCR on a contrast-enhanced copy so faint, low-contrast text is still
  // detected — then we measure its real colour from the ORIGINAL pixels.
  const ocrBuf = await sharp(buffer).grayscale().normalize().toBuffer();
  const res = await ocr(ocrBuf);
  const lines = linesFrom(res.data as { blocks?: unknown }).filter((l) => {
    const w = l.bbox.x1 - l.bbox.x0;
    const h = l.bbox.y1 - l.bbox.y0;
    return w > 6 && h > 6 && h < H * 0.5; // sane text boxes only
  });

  const elements: MeasuredElement[] = lines.map((l, idx) => {
    const { fg, bg } = fgBg(raw as Buffer, W, ch, l.bbox);
    const contrast = contrastRatio(fg, bg);
    const h = l.bbox.y1 - l.bbox.y0;
    // large text (>=24px or >=18.66px bold) gets the relaxed 3:1 threshold
    return {
      id: idx + 1,
      text: l.text.slice(0, 60),
      x: l.bbox.x0,
      y: l.bbox.y0,
      w: l.bbox.x1 - l.bbox.x0,
      h,
      fontPx: h,
      fg,
      bg,
      contrast: Math.round(contrast * 100) / 100,
      aa: contrast >= 4.5,
      aaLarge: contrast >= 3,
    };
  });

  const textEls = elements.filter((e) => e.text.length >= 2);
  const fails = textEls.filter((e) => (e.fontPx >= 28 ? !e.aaLarge : !e.aa));
  const contrastFailRate = textEls.length ? fails.length / textEls.length : 0;

  return {
    width: W,
    height: H,
    elements,
    palette: await palette(buffer),
    contrastFailRate: Math.round(contrastFailRate * 100) / 100,
  };
}
