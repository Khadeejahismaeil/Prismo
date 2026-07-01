import type { Analysis, DesignType, Issue, Severity, Source } from "@/lib/types";
import { analyze as mockAnalyze } from "@/lib/mock";
import { inspectImage, NOT_RASTER_MESSAGE } from "@/lib/image";
import { measureDesign, imageSize, imagePalette, type MeasuredElement, type Measurements } from "@/lib/measure";
import { buildMarks } from "@/lib/marks";
import { buildRasterIR, measureRasterColors, type Detection } from "@/lib/rasterIR";
import { toHex } from "@/lib/wcag";
import { flatten, measureIR, nodeCenterPct, type IR, type IRColor, type IRMeasurements } from "@/lib/ir";
import { callText, callVision, missingKeyMessage, providerKeyPresent } from "@/lib/ai";

/**
 * Hybrid server-side design review.
 *
 * 1. DETERMINISTIC layer (measure.ts): OCR + per-element WCAG contrast, font
 *    sizes, palette — real numbers, not guesses.
 * 2. SET-OF-MARKS (marks.ts): numbered boxes overlaid on the image so the model
 *    references box IDs instead of guessing x/y coordinates.
 * 3. The vision LLM gets the marked image + the measured facts and only does
 *    qualitative critique. Measured failures (e.g. contrast) are added by us.
 *
 * The AI provider (Gemini / OpenRouter) is behind lib/ai.ts. Falls back to a
 * plain image→LLM pass if the measurement step fails.
 */

const PRINCIPLES = `Review through these principles:
- Distinctiveness over templated defaults; reward a specific point of view, flag generic/AI-cliché looks.
- Hero as thesis; the big-number + gradient-accent hero is the template answer, flag it unless truly right.
- Typography with personality; flag neutral default type.
- Structure encodes meaning; flag decorative numbering when content is not a sequence.
- Restraint; boldness in one signature element, cut decoration that serves nothing.
- Copy is design material; plain active end-user language, specific over clever.`;

const SYSTEM = `You are Prismo, a Lead Product Designer giving a senior-level critique to another designer. You reason about VISUAL DESIGN and UX first — composition, hierarchy, typography, colour, balance, and how well the design serves its purpose and audience. You are specific and honest but constructive, like a respected mentor. Deterministic measurements (contrast, font sizes, spacing) are provided ONLY as evidence to support your reasoning; they are never the review itself. ${PRINCIPLES}`;

/** Design-type-specific focus. The criteria adapt to what the design is for. */
const TYPE_GUIDANCE: Record<string, string> = {
  "Mobile App":
    "This is a Mobile App. Weigh thumb-reach and tap ergonomics, one clear primary action per screen, native patterns and gestures, and whether the density suits a small screen.",
  Website:
    "This is a Website. Weigh the above-the-fold value proposition, navigation clarity, scannability, and whether the hero does its job.",
  Dashboard:
    "This is a Dashboard. ALSO evaluate: data hierarchy, scanability, KPI emphasis, chart readability, and filtering usability.",
  Presentation:
    "This is a Presentation slide. ALSO evaluate: slide hierarchy, text density, audience readability from the back of a room, flow of information, image/chart placement, presentation storytelling, and speaker-friendliness.",
  "Social Media Design":
    "This is a Social Media Design. Weigh stop-the-scroll impact, a single clear message, legibility at thumbnail size, a strong focal point, and brand recognizability.",
  Poster:
    "This is a Poster. Weigh hierarchy read from a distance, one dominant focal point, headline impact, and legibility at a glance.",
  Other:
    "Infer the design's purpose and audience first, then apply the general dimensions that fit.",
};
const typeBlock = (t: string) => TYPE_GUIDANCE[t] ?? TYPE_GUIDANCE.Other;

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, v));
};
const SEVS: Severity[] = ["low", "medium", "high"];

function decode(image: string): Buffer {
  const comma = image.indexOf(",");
  return Buffer.from(image.slice(comma + 1), "base64");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return JSON.parse(body.slice(start, end + 1));
}

function isNeutral(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) < 22;
}

/* ---------- deterministic issues from measurements ---------- */
function measuredIssues(m: Measurements): Issue[] {
  const text = m.elements.filter((e) => e.text.length >= 2);
  const fails = text
    .filter((e) => (e.fontPx >= 28 ? !e.aaLarge : !e.aa))
    .sort((a, b) => a.contrast - b.contrast)
    .slice(0, 2);
  return fails.map((e, i) => {
    const need = e.fontPx >= 28 ? "3:1" : "4.5:1";
    return {
      id: `m${i}`,
      title: "Low contrast text",
      explanation: `"${e.text}" sits at ${e.contrast}:1, below the readable minimum.`,
      severity: (e.contrast < 3 ? "high" : "medium") as Severity,
      x: Math.round(((e.x + e.w / 2) / m.width) * 1000) / 10,
      y: Math.round(((e.y + e.h / 2) / m.height) * 1000) / 10,
      measured: true,
      metric: `${e.contrast}:1 (needs ${need})`,
      solutions: [
        { id: "a", label: "Darken the text", detail: `Aim for at least ${need}.`, filter: "contrast(1.15) brightness(0.97)" },
        { id: "b", label: "Lighten behind it", detail: "Raise the surface separation." },
      ],
    };
  });
}

function blendedScore(m: Measurements, craft: number): number {
  const contrastScore = 100 - m.contrastFailRate * 70;
  const fonts = m.elements.map((e) => e.fontPx).sort((a, b) => a - b);
  const median = fonts[Math.floor(fonts.length / 2)] || 1;
  const max = fonts[fonts.length - 1] || 1;
  const ratio = max / median;
  const hierarchy = ratio >= 1.8 ? 100 : ratio >= 1.4 ? 80 : ratio >= 1.15 ? 65 : 50;
  const nonNeutral = m.palette.filter((p) => !isNeutral(p.hex) && p.pct >= 4).length;
  const palette = nonNeutral <= 3 ? 100 : nonNeutral <= 5 ? 75 : 55;
  // Visual judgment (craft) leads; measurements ground it.
  return Math.round(
    clamp(0.5 * craft + 0.25 * contrastScore + 0.15 * hierarchy + 0.1 * palette, 0, 100, 75),
  );
}

function metricsText(els: MeasuredElement[], m: Measurements): string {
  // Give SIZES for hierarchy reasoning, but only a SUMMARY of contrast so the
  // model doesn't fixate on enumerating accessibility failures.
  const sizes = els.map((e) => `${e.id}: "${e.text}" — ${e.fontPx}px`).join("\n");
  const textEls = els.filter((e) => e.text.length >= 2);
  const fails = textEls
    .filter((e) => (e.fontPx >= 28 ? !e.aaLarge : !e.aa))
    .sort((a, b) => a.contrast - b.contrast);
  const worst = fails.slice(0, 3).map((e) => `"${e.text}" (${e.contrast}:1)`).join(", ");
  const acc = fails.length
    ? `MEASURED ACCESSIBILITY (supporting evidence only): ${fails.length} of ${textEls.length} text elements fall below WCAG AA contrast — weakest: ${worst}. You may reference readability AT MOST ONCE as a supporting point; do NOT file separate contrast issues.`
    : `MEASURED ACCESSIBILITY: text contrast largely passes WCAG AA.`;
  const pal = m.palette.map((p) => `${p.hex} ${p.pct}%`).join(", ");
  return `The image has numbered red boxes over the main text elements. Element sizes (for hierarchy reasoning):
${sizes}
${acc}
Palette: ${pal}`;
}

function qualInstruction(designType: string, els: MeasuredElement[], m: Measurements): string {
  return `You are reviewing a design the user labelled "${designType}".

FIRST, identify the design's PURPOSE in one clause: what it is, who it's for, and its primary job. Review everything against that purpose.

${typeBlock(designType)}

Review across these dimensions WHERE APPLICABLE (skip the ones that don't fit this design): first impression, visual hierarchy, layout & composition, alignment & spacing, white space, typography, colour harmony, contrast, component consistency, CTA prominence, information architecture, readability, cognitive load, visual balance, brand consistency, accessibility, and overall polish.

${metricsText(els, m)}

Return ONLY a JSON object:
{
  "purpose": "one clause: what this is, who it's for, its primary job",
  "craftScore": integer 0-100 (holistic design quality for that purpose),
  "headline": short phrase, max 5 words,
  "summary": one short, plain sentence (under ~18 words),
  "strengths": array of 2-4 very short phrases,
  "issues": array of the 3-4 highest-impact problems only, most impactful first, each:
    { "markId": integer (the numbered box the issue is about, or 0 for a whole-layout/region issue),
      "title": 2-4 word label,
      "severity": "high" | "medium" | "low",
      "explanation": one short, plain sentence (under ~14 words) — no jargon,
      "why": one short clause on why it matters for THIS design's purpose,
      "solutions": array of 2-3 practical fixes, each { "label": 2-4 word action, "detail": one short clause } }
}
Rules:
- Write like a Lead Product Designer giving a peer specific, actionable feedback. NO generic advice.
- Only raise problems you can actually OBSERVE in the image. Never invent issues.
- Reason about VISUAL DESIGN and UX first. Contrast/accessibility is ALREADY measured: mention readability AT MOST ONCE and only as a supporting point. Do NOT enumerate low-contrast elements as separate issues — the MAJORITY of your issues must be about composition, hierarchy, typography, colour, spacing, component consistency, balance, and polish.
- At most 4 issues, and prefer fewer — only what truly matters, highest-impact first. If the design is genuinely strong, return 1-2 issues and a high craftScore.
- Always return valid JSON, never prose.`;
}

/** Where an issue points + any measured evidence for it. Raster resolves from a
 *  mark map; the IR path resolves from node ids. */
type Placement = { x: number; y: number; nodeId?: string; metric?: string; measured?: boolean; incomplete?: boolean };

function coerceQualitative(
  raw: unknown,
  resolve: (o: Record<string, unknown>) => Placement,
): { issues: Issue[]; craft: number; headline: string; summary: string; strengths: string[]; purpose?: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawIssues = Array.isArray(r.issues) ? r.issues.slice(0, 4) : [];
  const issues: Issue[] = rawIssues.map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const sols = (Array.isArray(o.solutions) ? o.solutions.slice(0, 3) : [])
      .map((s, j) => {
        const so = (s ?? {}) as Record<string, unknown>;
        return { id: String.fromCharCode(97 + j), label: String(so.label ?? "Refine it").slice(0, 40), detail: String(so.detail ?? "").slice(0, 80) };
      })
      .filter((s) => s.label);
    const p = resolve(o);
    return {
      id: `i${i}`,
      title: String(o.title ?? "Issue").slice(0, 32),
      explanation: String(o.explanation ?? "").slice(0, 120),
      why: o.why ? String(o.why).slice(0, 100) : undefined,
      severity: SEVS.includes(o.severity as Severity) ? (o.severity as Severity) : "medium",
      x: p.x,
      y: p.y,
      ...(p.nodeId ? { nodeId: p.nodeId } : {}),
      solutions: sols.length ? sols : [{ id: "a", label: "Refine it", detail: "" }],
      ...(p.metric ? { metric: p.metric } : {}),
      ...(p.measured ? { measured: true } : {}),
      ...(p.incomplete ? { incomplete: true } : {}),
    };
  });
  return {
    issues,
    craft: Math.round(clamp(r.craftScore, 0, 100, 78)),
    headline: String(r.headline ?? "Design review").slice(0, 40),
    summary: String(r.summary ?? "").slice(0, 140),
    strengths: (Array.isArray(r.strengths) ? r.strengths.slice(0, 4) : []).map((s) => String(s).slice(0, 60)),
    purpose: r.purpose ? String(r.purpose).slice(0, 160) : undefined,
  };
}

/** Heuristic: is this issue primarily about contrast/readability? */
function isContrastIssue(i: Issue): boolean {
  return /contrast|readab|legib|unreadable|invisible/i.test(`${i.title} ${i.explanation}`);
}

/** Contrast evidence keyed by mark id, to attach to the LLM's issues. */
function contrastEvidence(els: MeasuredElement[]): Record<number, string> {
  const ev: Record<number, string> = {};
  for (const e of els) {
    if (e.text.length < 2) continue;
    const fails = e.fontPx >= 28 ? !e.aaLarge : !e.aa;
    if (fails) ev[e.id] = `${e.contrast}:1 (needs ${e.fontPx >= 28 ? "3:1" : "4.5:1"})`;
  }
  return ev;
}

/* ---------- fallback: plain image → LLM (no measurements) ---------- */
function fallbackInstruction(designType: string): string {
  return `You are a Lead Product Designer reviewing a design the user labelled "${designType}". ${typeBlock(designType)}

First identify the design's purpose, then critique visual design and UX: first impression, hierarchy, layout, spacing, typography, colour, component consistency, CTA prominence, readability, balance, and polish. Respond with ONLY a JSON object:
{ "purpose": "what this is, who for, its job", "craftScore": 0-100, "headline": "<=5 words", "summary": "one sentence", "strengths": ["2-4 short"],
  "issues": [ up to 4 { "markId": 0, "title": "2-4 words", "severity": "high|medium|low", "explanation": "one short plain sentence, under ~14 words", "why": "short clause", "solutions": [ {"label":"2-4 words","detail":"short"} ] } ] }
Only observable problems, highest-impact first, no generic advice. Always valid JSON.`;
}

/* ---------- source (HTML / Figma) pipeline: analyse the IR ---------- */

function colorLabel(c: IRColor): string {
  if (c.rgb && !c.indeterminate) return toHex(c.rgb);
  if (c.indeterminate) return "gradient/image";
  return "?";
}

/** Compact element listing the model reasons over — real sizes, colours,
 *  positions, each with a STABLE id the model references (never guesses). */
function irBlock(ir: IR, m: IRMeasurements): string {
  const measured = new Map(m.elements.map((e) => [e.nodeId, e]));
  const nodes = Object.values(ir.flat)
    .filter((n) => n.bbox.w > 0 && n.bbox.h > 0)
    .sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h)
    .slice(0, 120);
  const lines = nodes.map((n) => {
    const pos = `@(${n.bbox.x},${n.bbox.y}) ${n.bbox.w}x${n.bbox.h}`;
    const font = n.fontPx ? ` ${n.fontPx}px/${n.fontWeight ?? "?"}` : "";
    const txt = n.text ? ` "${n.text.slice(0, 50)}"` : "";
    const col = n.text ? ` text ${colorLabel(n.color)} on ${colorLabel(n.bg)}` : "";
    const mm = measured.get(n.id);
    const con = mm ? (mm.status === "ok" ? ` contrast ${mm.contrast}:1` : " contrast: unresolved") : "";
    return `${n.id} [${n.role}] ${pos}${font}${txt}${col}${con}`;
  });

  const fails = m.elements.filter((e) => e.status === "ok" && (e.fontPx >= 28 ? !e.aaLarge : !e.aa));
  const worst = fails
    .sort((a, b) => (a.contrast ?? 99) - (b.contrast ?? 99))
    .slice(0, 3)
    .map((e) => `"${e.text}" (${e.contrast}:1)`)
    .join(", ");
  const acc = fails.length
    ? `MEASURED ACCESSIBILITY (supporting evidence only): ${fails.length} of ${m.elements.length} text elements fall below WCAG AA — weakest: ${worst}. Reference readability AT MOST ONCE; do NOT file separate contrast issues.`
    : m.incompleteCount
      ? `MEASURED ACCESSIBILITY: contrast largely passes AA (${m.incompleteCount} elements sit on gradients/images and could not be measured).`
      : "MEASURED ACCESSIBILITY: text contrast largely passes WCAG AA.";
  const pal = m.palette.map((p) => `${p.hex} ${p.pct}%`).join(", ");

  return `This is the EXACT element tree (real measured geometry, colours and sizes), viewport ${ir.viewport.w}x${ir.viewport.h}px. Reference elements by their id (e.g. n12).
${lines.join("\n")}
${acc}
Palette: ${pal}`;
}

function irInstruction(designType: string, ir: IR, m: IRMeasurements): string {
  return `You are reviewing a design the user labelled "${designType}".

FIRST, identify the design's PURPOSE in one clause: what it is, who it's for, and its primary job. Review everything against that purpose.

${typeBlock(designType)}

Review across these dimensions WHERE APPLICABLE (skip the ones that don't fit): first impression, visual hierarchy, layout & composition, alignment & spacing, white space, typography, colour harmony, contrast, component consistency, CTA prominence, information architecture, readability, cognitive load, visual balance, brand consistency, accessibility, and overall polish.

${irBlock(ir, m)}

Return ONLY a JSON object:
{
  "purpose": "one clause: what this is, who it's for, its primary job",
  "craftScore": integer 0-100 (holistic design quality for that purpose),
  "headline": short phrase, max 5 words,
  "summary": one short, plain sentence (under ~18 words),
  "strengths": array of 2-4 very short phrases,
  "issues": array of the 3-4 highest-impact problems only, most impactful first, each:
    { "nodeId": string (the element id the issue is about, e.g. "n12", or "" for a whole-layout issue),
      "title": 2-4 word label,
      "severity": "high" | "medium" | "low",
      "explanation": one short, plain sentence (under ~14 words) — no jargon,
      "why": one short clause on why it matters for THIS design's purpose,
      "solutions": array of 2-3 practical fixes, each { "label": 2-4 word action, "detail": one short clause } }
}
Rules:
- Write like a Lead Product Designer giving a peer specific, actionable feedback. NO generic advice.
- Reason about VISUAL DESIGN and UX first. Contrast/accessibility is ALREADY measured: mention readability AT MOST ONCE. The MAJORITY of issues must be about composition, hierarchy, typography, colour, spacing, component consistency, balance, and polish.
- Every issue MUST set nodeId to a real id from the tree above (or "" for a whole-layout issue). Never invent ids.
- At most 4 issues, and prefer fewer — only what truly matters, highest-impact first. If the design is genuinely strong, return 1-2 issues and a high craftScore.
- Always return valid JSON, never prose.`;
}

/** Blend measured signals with the model's craft judgment (measurements ground it). */
function irScore(m: IRMeasurements, craft: number): number {
  const contrastScore = 100 - m.contrastFailRate * 70;
  const hierarchy = m.hierarchyRatio >= 1.8 ? 100 : m.hierarchyRatio >= 1.4 ? 80 : m.hierarchyRatio >= 1.15 ? 65 : 50;
  const nonNeutral = m.palette.filter((p) => !isNeutral(p.hex) && p.pct >= 4).length;
  const palette = nonNeutral <= 3 ? 100 : nonNeutral <= 5 ? 75 : 55;
  return Math.round(clamp(0.5 * craft + 0.25 * contrastScore + 0.15 * hierarchy + 0.1 * palette, 0, 100, 75));
}

async function analyzeIR(irRaw: unknown, kind: "html" | "figma", designType: string): Promise<Response> {
  const parsed = irRaw as IR | undefined;
  if (!parsed || !parsed.root || !parsed.viewport) {
    return Response.json({ error: "The design could not be parsed into a reviewable structure." }, { status: 422 });
  }
  // Rebuild the flat index server-side so lookups use the received node instances.
  const ir: IR = { ...parsed, kind, flat: flatten(parsed.root) };
  const m = measureIR(ir);
  console.log(`[analyze] IR(${kind}) ${Object.keys(ir.flat).length} nodes, ${m.elements.length} text, fail ${m.contrastFailRate}, incomplete ${m.incompleteCount}`);

  const content = await callText({
    system: SYSTEM,
    prompt: irInstruction(designType, ir, m),
    maxTokens: 1500,
  });

  const q = coerceQualitative(extractJson(content), (o) => {
    const id = String(o.nodeId ?? "").trim();
    const node = id ? ir.flat[id] : undefined;
    const pos = node ? nodeCenterPct(node, ir.viewport) : { x: 50, y: 50 };
    const mm = id ? m.elements.find((e) => e.nodeId === id) : undefined;
    if (mm && mm.status === "incomplete") return { x: pos.x, y: pos.y, nodeId: id, incomplete: true };
    if (mm && mm.status === "ok" && (mm.fontPx >= 28 ? !mm.aaLarge : !mm.aa)) {
      return { x: pos.x, y: pos.y, nodeId: id, metric: `${mm.contrast}:1 (needs ${mm.fontPx >= 28 ? "3:1" : "4.5:1"})`, measured: true };
    }
    return { x: pos.x, y: pos.y, ...(id ? { nodeId: id } : {}) };
  });

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return Response.json({
    id: `a${Date.now()}`,
    score: irScore(m, q.craft),
    headline: q.headline,
    summary: q.summary || "Here's how this reads as a designer.",
    purpose: q.purpose,
    strengths: q.strengths.length ? q.strengths : ["Clean overall composition"],
    issues: q.issues.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 4),
    metrics: { contrastFailRate: m.contrastFailRate, textElements: m.elements.length, palette: m.palette },
    sourceKind: kind,
    viewport: ir.viewport,
  } satisfies Analysis);
}

/* ---------- robust raster pipeline: vision detection → IR → grounded critique ---------- */

const DETECT_SYSTEM =
  "You are a precise UI element detector. You return tight bounding boxes for the salient elements in a UI screenshot, and nothing else.";

function detectPrompt(designType: string): string {
  return `Detect the salient UI elements in this ${designType} screenshot.
Return ONLY a JSON array (no prose, no markdown). Each item:
{ "role": one of "heading"|"text"|"button"|"input"|"image"|"icon"|"logo"|"container",
  "text": the element's visible text, or "" if none,
  "box": [ymin, xmin, ymax, xmax] as integers normalised to 0-1000 }
Include every distinct TEXT element (headings, labels, paragraphs, prices, button labels) plus major regions/cards. Boxes must be tight around each element. Max 40 items, most prominent first.`;
}

function parseDetections(text: string): Detection[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  let arr: unknown;
  const s = body.indexOf("[");
  const e = body.lastIndexOf("]");
  if (s !== -1 && e !== -1) {
    try {
      arr = JSON.parse(body.slice(s, e + 1));
    } catch {
      /* try object form next */
    }
  }
  if (!Array.isArray(arr)) {
    try {
      const o = JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1)) as Record<string, unknown>;
      arr = (o.elements ?? o.detections ?? o.boxes) as unknown;
    } catch {
      /* give up */
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((d): d is Record<string, unknown> => Boolean(d) && Array.isArray((d as Record<string, unknown>).box))
    .map((d) => ({
      role: typeof d.role === "string" ? d.role : undefined,
      text: typeof d.text === "string" ? d.text : undefined,
      box: (d.box as unknown[]).slice(0, 4).map((n) => Number(n)) as [number, number, number, number],
    }))
    .filter((d) => d.box.length === 4 && d.box.every((n) => Number.isFinite(n)));
}

/** Critique prompt for the marked screenshot; the model references box NUMBERS. */
function rasterCritiqueInstruction(designType: string, ir: IR, m: IRMeasurements): string {
  const measured = new Map(m.elements.map((e) => [e.nodeId, e]));
  const lines = Object.values(ir.flat)
    .filter((n) => n.bbox.w > 0 && n.bbox.h > 0 && n.id !== "n0")
    .map((n) => {
      const num = n.id.slice(1);
      const txt = n.text ? ` "${n.text.slice(0, 50)}"` : "";
      const col = n.text ? ` ${colorLabel(n.color)} on ${colorLabel(n.bg)}` : "";
      const mm = measured.get(n.id);
      const con = mm ? (mm.status === "ok" ? ` contrast ${mm.contrast}:1` : " contrast: unresolved") : "";
      return `box ${num} [${n.role}]${txt}${col}${con}`;
    });
  const fails = m.elements.filter((e) => e.status === "ok" && (e.fontPx >= 28 ? !e.aaLarge : !e.aa));
  const acc = fails.length
    ? `MEASURED ACCESSIBILITY (evidence only): ${fails.length} of ${m.elements.length} text elements fall below WCAG AA. Reference readability AT MOST ONCE; do NOT file separate contrast issues.`
    : "MEASURED ACCESSIBILITY: text contrast largely passes WCAG AA.";
  const pal = m.palette.map((p) => `${p.hex} ${p.pct}%`).join(", ");

  return `You are reviewing a design the user labelled "${designType}". The screenshot has numbered red boxes over its elements.

FIRST, identify the design's PURPOSE in one clause: what it is, who it's for, its primary job. Review everything against that purpose.

${typeBlock(designType)}

Review across these dimensions WHERE APPLICABLE: first impression, visual hierarchy, layout & composition, alignment & spacing, white space, typography, colour harmony, contrast, component consistency, CTA prominence, information architecture, readability, cognitive load, visual balance, brand consistency, accessibility, and overall polish.

Detected elements (reference these box numbers):
${lines.join("\n")}
${acc}
Palette: ${pal}

Return ONLY a JSON object:
{
  "purpose": "one clause",
  "craftScore": integer 0-100,
  "headline": short phrase, max 5 words,
  "summary": one short, plain sentence (under ~18 words),
  "strengths": array of 2-4 very short phrases,
  "issues": array of the 3-4 highest-impact problems, most impactful first, each:
    { "markId": integer (the box number the issue is about, or 0 for a whole-layout issue),
      "title": 2-4 word label,
      "severity": "high" | "medium" | "low",
      "explanation": one short, plain sentence (under ~14 words) — no jargon,
      "why": one short clause on why it matters for THIS design's purpose,
      "solutions": array of 2-3 fixes, each { "label": 2-4 word action, "detail": one short clause } }
}
Rules:
- Write like a Lead Product Designer. NO generic advice. Reason about VISUAL DESIGN and UX first.
- Contrast is ALREADY measured: mention readability AT MOST ONCE. The majority of issues must be about composition, hierarchy, typography, colour, spacing, consistency, balance, polish.
- markId must be a real box number above (or 0). At most 4 issues (prefer fewer). Always valid JSON.`;
}

/**
 * Two-pass vision raster review. Returns null (so the caller falls back to the
 * legacy OCR path) when detection yields nothing usable.
 */
async function analyzeRasterVision(image: string, designType: string, buffer: Buffer): Promise<Response | null> {
  const { W, H } = await imageSize(buffer);
  if (!W || !H) return null;

  // ---- 1. detection pass → real element boxes (replaces OCR) ----
  const detRaw = await callVision({
    system: DETECT_SYSTEM,
    prompt: detectPrompt(designType),
    imageDataUrl: image,
    maxTokens: 2200,
    temperature: 0,
  });
  const dets = parseDetections(detRaw);
  console.log(`[analyze] raster detection: ${dets.length} elements`);
  if (dets.length < 2) return null;

  const ir = buildRasterIR(dets, W, H);
  // ---- 2. measure real-pixel contrast per box (honest 'incomplete' on gradients) ----
  await measureRasterColors(buffer, ir);
  const m = measureIR(ir);
  m.palette = await imagePalette(buffer); // whole-image palette beats sparse node colours here

  // ---- 3. set-of-marks from the (accurate) detection boxes ----
  const textNodes = Object.values(ir.flat).filter((n) => n.text && n.id !== "n0");
  if (!textNodes.length) return null;
  const markInputs = textNodes.map((n) => ({ id: Number(n.id.slice(1)), x: n.bbox.x, y: n.bbox.y, w: n.bbox.w, h: n.bbox.h }));
  const { dataUrl } = await buildMarks(buffer, W, H, markInputs);

  // ---- 4. grounded critique pass over the marked image ----
  const content = await callVision({
    system: SYSTEM,
    prompt: rasterCritiqueInstruction(designType, ir, m),
    imageDataUrl: dataUrl,
    maxTokens: 1500,
  });
  const q = coerceQualitative(extractJson(content), (o) => {
    const node = ir.flat[`n${Number(o.markId)}`];
    const pos = node ? nodeCenterPct(node, ir.viewport) : { x: 50, y: 50 };
    const mm = node ? m.elements.find((e) => e.nodeId === node.id) : undefined;
    if (mm && mm.status === "incomplete") return { x: pos.x, y: pos.y, nodeId: node?.id, incomplete: true };
    if (mm && mm.status === "ok" && (mm.fontPx >= 28 ? !mm.aaLarge : !mm.aa)) {
      return { x: pos.x, y: pos.y, nodeId: node?.id, metric: `${mm.contrast}:1 (needs ${mm.fontPx >= 28 ? "3:1" : "4.5:1"})`, measured: true };
    }
    return { x: pos.x, y: pos.y, ...(node ? { nodeId: node.id } : {}) };
  });

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return Response.json({
    id: `a${Date.now()}`,
    score: irScore(m, q.craft),
    headline: q.headline,
    summary: q.summary || "Here's how this reads as a designer.",
    purpose: q.purpose,
    strengths: q.strengths.length ? q.strengths : ["Clean overall composition"],
    issues: q.issues.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 4),
    metrics: { contrastFailRate: m.contrastFailRate, textElements: m.elements.length, palette: m.palette },
    sourceKind: "raster",
    viewport: { w: W, h: H },
  } satisfies Analysis);
}

export async function POST(req: Request) {
  let source: Source | null = null;
  let irRaw: unknown = undefined;
  let designType = "Mobile App";
  try {
    const body = await req.json();
    designType = body.designType ?? "Mobile App";
    irRaw = body.ir;
    // New clients send { source }; old clients send { image } (raster).
    source = body.source ?? (body.image ? { kind: "raster", payload: body.image } : null);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!source || !source.payload) return Response.json({ error: "No design provided" }, { status: 400 });

  if (process.env.USE_MOCK_ANALYSIS === "1") {
    return Response.json(mockAnalyze(designType as DesignType, source.payload.length % 997));
  }
  if (!providerKeyPresent()) {
    return Response.json({ error: missingKeyMessage() }, { status: 503 });
  }

  // ---- source pipeline: analyse the client-built IR (no image needed) ----
  if (source.kind === "html" || source.kind === "figma") {
    try {
      return await analyzeIR(irRaw, source.kind, designType);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ---- raster pipeline (legacy image path) ----
  const image = source.payload;
  const info = inspectImage(image);
  console.log(`[analyze] image ${info.kind} ${info.mime ?? "?"} ~${info.kb ?? "?"}KB raster=${info.isRaster} type=${designType}`);

  if (!info.isRaster) return Response.json({ error: NOT_RASTER_MESSAGE }, { status: 415 });

  // ---- robust two-pass vision path (detection → real-pixel measure → grounded critique) ----
  try {
    const res = await analyzeRasterVision(image, designType, decode(image));
    if (res) return res;
    console.warn("[analyze] raster detection empty — falling back to OCR pipeline");
  } catch (e) {
    console.warn("[analyze] raster vision path failed — falling back to OCR:", e instanceof Error ? e.message : e);
  }

  // ---- 1. deterministic measurements (best-effort OCR fallback) ----
  let measurements: Measurements | null = null;
  try {
    measurements = await measureDesign(decode(image));
    console.log(`[analyze] measured ${measurements.elements.length} text elements, contrast fail rate ${measurements.contrastFailRate}`);
  } catch (e) {
    console.warn("[analyze] measurement failed, falling back:", e instanceof Error ? e.message : e);
  }

  try {
    if (measurements && measurements.elements.length > 0) {
      // ---- 2. set-of-marks + contrast evidence keyed by mark id ----
      const els = [...measurements.elements].sort((a, b) => b.fontPx - a.fontPx).slice(0, 16);
      const { dataUrl, map } = await buildMarks(decode(image), measurements.width, measurements.height, els);
      const evidence = contrastEvidence(els);

      // ---- 3. senior-designer visual review; measurements are only evidence ----
      let q: ReturnType<typeof coerceQualitative> | null = null;
      try {
        const content = await callVision({
          system: SYSTEM,
          prompt: qualInstruction(designType, els, measurements),
          imageDataUrl: dataUrl,
          maxTokens: 1500,
        });
        q = coerceQualitative(extractJson(content), (o) => {
          const mid = Number(o.markId);
          const pos = map[mid] ?? { x: 50, y: 50 };
          const ev = evidence[mid];
          return { x: pos.x, y: pos.y, ...(ev ? { metric: ev, measured: true } : {}) };
        });
      } catch (e) {
        console.warn("[analyze] review failed, returning measured-only:", e instanceof Error ? e.message : e);
      }

      const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      const metrics = {
        contrastFailRate: measurements.contrastFailRate,
        textElements: measurements.elements.length,
        palette: measurements.palette,
      };

      if (q) {
        // keep at most one contrast/readability issue; the rest must be visual/UX
        let contrastKept = 0;
        const issues = q.issues
          .filter((i) => (isContrastIssue(i) ? contrastKept++ < 1 : true))
          .sort((a, b) => rank[a.severity] - rank[b.severity])
          .slice(0, 4);
        return Response.json({
          id: `a${Date.now()}`,
          score: blendedScore(measurements, q.craft),
          headline: q.headline,
          summary: q.summary || "Here's how this reads as a designer.",
          purpose: q.purpose,
          strengths: q.strengths.length ? q.strengths : ["Clean overall composition"],
          issues,
          metrics,
        } satisfies Analysis);
      }

      // model unavailable → still return the trustworthy measured findings
      const det = measuredIssues(measurements);
      return Response.json({
        id: `a${Date.now()}`,
        score: blendedScore(measurements, 72),
        headline: det.length ? "Measured a few fixes" : "Measurements look clean",
        summary: "The review model was unavailable, so these are the measured findings only.",
        strengths: ["Clean overall composition"],
        issues: det,
        metrics,
      } satisfies Analysis);
    }

    // ---- fallback: no measurements ----
    const content = await callVision({
      system: SYSTEM,
      prompt: fallbackInstruction(designType),
      imageDataUrl: image,
      maxTokens: 1500,
    });
    const q = coerceQualitative(extractJson(content), () => ({ x: 50, y: 50 }));
    return Response.json({
      id: `a${Date.now()}`,
      score: q.craft,
      headline: q.headline,
      summary: q.summary,
      purpose: q.purpose,
      strengths: q.strengths.length ? q.strengths : ["Clean overall composition"],
      issues: q.issues,
    } satisfies Analysis);
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "The model took too long to respond. Free models can be slow, try again."
      : e instanceof Error
        ? e.message
        : "Analysis failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
