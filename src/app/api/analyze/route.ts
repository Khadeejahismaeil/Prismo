import type { Analysis, DesignType, Issue, Severity } from "@/lib/types";
import { analyze as mockAnalyze } from "@/lib/mock";
import { inspectImage, NOT_RASTER_MESSAGE } from "@/lib/image";
import { measureDesign, type MeasuredElement, type Measurements } from "@/lib/measure";
import { buildMarks, type MarkMap } from "@/lib/marks";
import { callVision, missingKeyMessage, providerKeyPresent } from "@/lib/ai";

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
  "summary": one sentence in a senior designer's voice,
  "strengths": array of 2-4 very short phrases,
  "issues": array of the 5-6 HIGHEST-IMPACT problems only, most impactful first, each:
    { "markId": integer (the numbered box the issue is about, or 0 for a whole-layout/region issue),
      "title": 2-4 word label,
      "severity": "high" | "medium" | "low",
      "explanation": one plain sentence describing the problem you can SEE,
      "why": one short clause on why it matters for THIS design's purpose,
      "solutions": array of 2-3 practical fixes, each { "label": 2-4 word action, "detail": one short clause } }
}
Rules:
- Write like a Lead Product Designer giving a peer specific, actionable feedback. NO generic advice.
- Only raise problems you can actually OBSERVE in the image. Never invent issues.
- Reason about VISUAL DESIGN and UX first. Contrast/accessibility is ALREADY measured: mention readability AT MOST ONCE and only as a supporting point. Do NOT enumerate low-contrast elements as separate issues — the MAJORITY of your issues must be about composition, hierarchy, typography, colour, spacing, component consistency, balance, and polish.
- At most 6 issues, highest-impact first. If the design is genuinely strong, return few issues and a high craftScore.
- Always return valid JSON, never prose.`;
}

function coerceQualitative(
  raw: unknown,
  map: MarkMap,
  markEvidence: Record<number, string>,
): { issues: Issue[]; craft: number; headline: string; summary: string; strengths: string[]; purpose?: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawIssues = Array.isArray(r.issues) ? r.issues.slice(0, 6) : [];
  const issues: Issue[] = rawIssues.map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const sols = (Array.isArray(o.solutions) ? o.solutions.slice(0, 3) : [])
      .map((s, j) => {
        const so = (s ?? {}) as Record<string, unknown>;
        return { id: String.fromCharCode(97 + j), label: String(so.label ?? "Refine it").slice(0, 40), detail: String(so.detail ?? "").slice(0, 80) };
      })
      .filter((s) => s.label);
    const mid = Number(o.markId);
    const pos = map[mid] ?? { x: 50, y: 50 };
    const evidence = markEvidence[mid];
    return {
      id: `i${i}`,
      title: String(o.title ?? "Issue").slice(0, 40),
      explanation: String(o.explanation ?? "").slice(0, 160),
      why: o.why ? String(o.why).slice(0, 160) : undefined,
      severity: SEVS.includes(o.severity as Severity) ? (o.severity as Severity) : "medium",
      x: pos.x,
      y: pos.y,
      solutions: sols.length ? sols : [{ id: "a", label: "Refine it", detail: "" }],
      ...(evidence ? { metric: evidence, measured: true } : {}),
    };
  });
  return {
    issues,
    craft: Math.round(clamp(r.craftScore, 0, 100, 78)),
    headline: String(r.headline ?? "Design review").slice(0, 40),
    summary: String(r.summary ?? "").slice(0, 220),
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
  "issues": [ up to 6 { "markId": 0, "title": "2-4 words", "severity": "high|medium|low", "explanation": "one sentence you can SEE", "why": "why it matters", "solutions": [ {"label":"2-4 words","detail":"short"} ] } ] }
Only observable problems, highest-impact first, no generic advice. Always valid JSON.`;
}

export async function POST(req: Request) {
  let image = "";
  let designType = "Mobile App";
  try {
    const body = await req.json();
    image = body.image ?? "";
    designType = body.designType ?? "Mobile App";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "No image provided" }, { status: 400 });

  const info = inspectImage(image);
  console.log(`[analyze] image ${info.kind} ${info.mime ?? "?"} ~${info.kb ?? "?"}KB raster=${info.isRaster} type=${designType}`);

  if (process.env.USE_MOCK_ANALYSIS === "1") {
    return Response.json(mockAnalyze(designType as DesignType, image.length % 997));
  }
  if (!info.isRaster) return Response.json({ error: NOT_RASTER_MESSAGE }, { status: 415 });

  if (!providerKeyPresent()) {
    return Response.json({ error: missingKeyMessage() }, { status: 503 });
  }

  // ---- 1. deterministic measurements (best-effort) ----
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
        q = coerceQualitative(extractJson(content), map, evidence);
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
          .slice(0, 6);
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
    const q = coerceQualitative(extractJson(content), {}, {});
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
