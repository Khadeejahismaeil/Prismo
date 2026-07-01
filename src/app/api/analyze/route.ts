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

const SYSTEM = `You are Prismo, a senior product designer reviewing a UI screenshot. Be specific, warm, and constructive. ${PRINCIPLES} Keep every piece of text short and concrete.`;

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
    .slice(0, 3);
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
  return Math.round(
    clamp(0.35 * contrastScore + 0.2 * hierarchy + 0.15 * palette + 0.3 * craft, 0, 100, 75),
  );
}

function metricsText(els: MeasuredElement[], m: Measurements): string {
  const rows = els
    .map((e) => `${e.id}: "${e.text}" | ${e.fontPx}px | ${e.contrast}:1`)
    .join("\n");
  const pal = m.palette.map((p) => `${p.hex} ${p.pct}%`).join(", ");
  return `Numbered boxes mark detected text. MEASURED facts (already computed — never restate or invent these numbers):\nid: "text" | fontPx | contrast\n${rows}\nPalette: ${pal}`;
}

function qualInstruction(designType: string, els: MeasuredElement[], m: Measurements): string {
  return `Review this ${designType} screenshot. ${metricsText(els, m)}

Return ONLY a JSON object:
{
  "craftScore": integer 0-100 (your qualitative judgment of craft/distinctiveness),
  "headline": short phrase, max 5 words,
  "summary": one short sentence,
  "strengths": array of 2-4 very short phrases,
  "issues": array of up to 4 qualitative problems, most impactful first, each:
    { "markId": integer (the numbered box this is about, or 0 if none),
      "title": 2-4 word label,
      "explanation": one short, plain sentence,
      "severity": "high" | "medium" | "low",
      "solutions": array of 2-3 fixes, each { "label": 2-4 word action, "detail": one short clause } }
}
Rules:
- Reference real locations by markId. Do NOT invent or restate contrast numbers — they are given and handled separately.
- Only QUALITATIVE/principle issues (hierarchy, CTA clarity, distinctiveness, spacing, copy). Skip contrast.
- If the design is strong, return few/no issues and a high craftScore.
- Always return valid JSON, never prose.`;
}

function coerceQualitative(raw: unknown, map: MarkMap, startIdx: number): { issues: Issue[]; craft: number; headline: string; summary: string; strengths: string[] } {
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
    const mid = Number(o.markId);
    const pos = map[mid] ?? { x: 50, y: 50 };
    return {
      id: `i${startIdx + i}`,
      title: String(o.title ?? "Issue").slice(0, 40),
      explanation: String(o.explanation ?? "").slice(0, 140),
      severity: SEVS.includes(o.severity as Severity) ? (o.severity as Severity) : "medium",
      x: pos.x,
      y: pos.y,
      solutions: sols.length ? sols : [{ id: "a", label: "Refine it", detail: "" }],
    };
  });
  return {
    issues,
    craft: Math.round(clamp(r.craftScore, 0, 100, 78)),
    headline: String(r.headline ?? "Nice work").slice(0, 40),
    summary: String(r.summary ?? "").slice(0, 200),
    strengths: (Array.isArray(r.strengths) ? r.strengths.slice(0, 4) : []).map((s) => String(s).slice(0, 60)),
  };
}

/* ---------- fallback: plain image → LLM (no measurements) ---------- */
function fallbackInstruction(designType: string): string {
  return `Review this ${designType} screenshot. Respond with ONLY a JSON object:
{ "craftScore": 0-100, "headline": "<=5 words", "summary": "one sentence", "strengths": ["2-4 short"],
  "issues": [ up to 4 { "markId": 0, "title": "2-4 words", "explanation": "one sentence", "severity": "high|medium|low", "solutions": [ {"label":"2-4 words","detail":"short"} ] } ] }
Ground issues in the real image. If strong, few/no issues + high craftScore. Always valid JSON.`;
}

export async function POST(req: Request) {
  let image = "";
  let designType = "Mobile app";
  try {
    const body = await req.json();
    image = body.image ?? "";
    designType = body.designType ?? "Mobile app";
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
      // ---- 2. set-of-marks ----
      const els = [...measurements.elements].sort((a, b) => b.fontPx - a.fontPx).slice(0, 16);
      const { dataUrl, map } = await buildMarks(decode(image), measurements.width, measurements.height, els);
      const det = measuredIssues(measurements);

      // ---- 3. qualitative LLM pass (best-effort: keep the measured findings even if the model fails) ----
      let q: ReturnType<typeof coerceQualitative> | null = null;
      try {
        const content = await callVision({
          system: SYSTEM,
          prompt: qualInstruction(designType, els, measurements),
          imageDataUrl: dataUrl,
          maxTokens: 1024,
        });
        q = coerceQualitative(extractJson(content), map, det.length);
      } catch (e) {
        console.warn("[analyze] qualitative pass failed, returning measured-only:", e instanceof Error ? e.message : e);
      }

      const issues = (q ? [...det, ...q.issues] : det).slice(0, 5);
      const score = blendedScore(measurements, q ? q.craft : 72);
      const analysis: Analysis = {
        id: `a${Date.now()}`,
        score,
        headline: q
          ? det.length && q.headline === "Nice work"
            ? "A few quick wins"
            : q.headline
          : det.length
            ? "Measured a few fixes"
            : "Measurements look clean",
        summary: q?.summary || "Here are the measured findings for this screen.",
        strengths: q?.strengths.length ? q.strengths : ["Clean overall composition"],
        issues,
        metrics: {
          contrastFailRate: measurements.contrastFailRate,
          textElements: measurements.elements.length,
          palette: measurements.palette,
        },
      };
      return Response.json(analysis);
    }

    // ---- fallback: no measurements ----
    const content = await callVision({
      system: SYSTEM,
      prompt: fallbackInstruction(designType),
      imageDataUrl: image,
      maxTokens: 1024,
    });
    const q = coerceQualitative(extractJson(content), {}, 0);
    return Response.json({
      id: `a${Date.now()}`,
      score: q.craft,
      headline: q.headline,
      summary: q.summary,
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
