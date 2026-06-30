import type { Analysis, DesignType, Issue, Severity } from "@/lib/types";
import { analyze as mockAnalyze } from "@/lib/mock";

/**
 * Server-side design review. Sends the uploaded screenshot to a vision model
 * via OpenRouter and returns a structured Analysis. The API key lives only on
 * the server (process.env.OPENROUTER_API_KEY), never in the browser.
 *
 * Env:
 *   OPENROUTER_API_KEY   required (unless USE_MOCK_ANALYSIS=1)
 *   OPENROUTER_MODEL     defaults to anthropic/claude-opus-4.1
 *   USE_MOCK_ANALYSIS=1  skip the model and return mock data (for testing wiring)
 */

const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-opus-4.1";

const SYSTEM = `You are Prismo, a senior product designer reviewing a single UI screenshot. You judge work by one standard: is this a distinctive, intentional design, or a templated default? Be specific and grounded in exactly what is visible in the pixels. Be warm and constructive, never harsh. Only flag problems a senior designer would agree with. If the design is genuinely strong and distinctive, return few or no issues and a high score. Keep every piece of text short and concrete.

Review through these principles:
- Distinctiveness over defaults. Reward a specific point of view tied to the product's subject; flag generic, templated looks. Watch for the AI/template clichés and call them out: warm cream background + high-contrast serif + terracotta accent; near-black background + one acid-green or vermilion accent; broadsheet hairline rules with dense newspaper columns. These are defaults, not choices.
- Hero as thesis. The top should open with the most characteristic thing about the product. The big-number + small-label + gradient-accent hero is the template answer; flag it unless it is truly the best option here.
- Typography with personality. Look for a deliberate display/body pairing, a clear type scale, and intentional weights, widths, and spacing. Flag neutral, default type that is just a delivery vehicle.
- Structure encodes meaning. Numbering (01 / 02 / 03), eyebrows, dividers, and labels should carry real information, not decorate. Flag numbered markers when the content is not actually a sequence.
- Restraint. Boldness should live in one signature element while everything else stays quiet and disciplined. Flag scattered decoration that serves nothing (the "remove one accessory" test).
- Match complexity to intent. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail.
- Copy is design material. Favor plain, active, end-user language ("Save changes", not "Submit"), specific over clever, and one consistent vocabulary across the flow; errors and empty states should give direction. Flag copy that sells, hedges, is vague, or names things by how the system is built.
- Quality floor: clear visual hierarchy, legible contrast, comfortable spacing, and one obvious primary action.

For each issue, frame it around the principle it breaks, in plain language, and make every fix move the design toward a more intentional, less templated result.`;

function instruction(designType: string) {
  return `Review this ${designType} screenshot. Respond with ONLY a JSON object (no markdown, no commentary) of this exact shape:
{
  "score": integer 0-100 (overall design quality),
  "headline": short encouraging phrase, max 5 words,
  "summary": one short sentence,
  "strengths": array of 2-4 very short phrases describing what works,
  "issues": array of 0-4 of the MOST important problems, most impactful first, each:
    {
      "title": 2-4 word label,
      "explanation": one short, plain sentence,
      "severity": "high" | "medium" | "low",
      "x": number 0-100, horizontal percent of the image at the center of the problem,
      "y": number 0-100, vertical percent of the image,
      "solutions": array of 2-3 distinct fixes, each { "label": 2-4 word action, "detail": one short clause }
    }
}
Rules:
- Ground every issue and every x/y on the real element in the image.
- Only include issues you are confident about. If the screen is genuinely good, use "issues": [] and a high score.
- Frame each issue around the design principle it breaks.
- Keep all text tight, a designer's shorthand. No filler.
- Always return the JSON object, even for a rough review. Never reply with prose.`;
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, v));
};

const SEVS: Severity[] = ["low", "medium", "high"];

/** Validate + coerce raw model JSON into a safe Analysis with ids. */
function coerce(raw: unknown): Analysis {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawIssues = Array.isArray(r.issues) ? r.issues.slice(0, 4) : [];

  const issues: Issue[] = rawIssues.map((it, i) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const sols = Array.isArray(o.solutions) ? o.solutions.slice(0, 3) : [];
    const solutions = sols
      .map((s, j) => {
        const so = (s ?? {}) as Record<string, unknown>;
        return {
          id: String.fromCharCode(97 + j), // a, b, c
          label: String(so.label ?? "Improve it").slice(0, 40),
          detail: String(so.detail ?? "").slice(0, 80),
        };
      })
      .filter((s) => s.label);
    return {
      id: `i${i}`,
      title: String(o.title ?? "Issue").slice(0, 40),
      explanation: String(o.explanation ?? "").slice(0, 140),
      severity: SEVS.includes(o.severity as Severity) ? (o.severity as Severity) : "medium",
      x: clamp(o.x, 2, 98, 50),
      y: clamp(o.y, 2, 98, 50),
      solutions: solutions.length ? solutions : [{ id: "a", label: "Refine it", detail: "" }],
    };
  });

  const strengths = Array.isArray(r.strengths)
    ? r.strengths.slice(0, 4).map((s) => String(s).slice(0, 60))
    : [];

  return {
    id: `a${Date.now()}`,
    score: Math.round(clamp(r.score, 0, 100, 80)),
    headline: String(r.headline ?? (issues.length ? "Nice work" : "A stunner ✨")).slice(0, 40),
    summary: String(r.summary ?? "").slice(0, 200),
    strengths: strengths.length ? strengths : ["Clean overall composition"],
    issues,
  };
}

/** Pull a JSON object out of a model response that may include fences/prose. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return JSON.parse(body.slice(start, end + 1));
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

  // Test path: exercise the full client→server→UI plumbing without a key.
  if (process.env.USE_MOCK_ANALYSIS === "1") {
    return Response.json(mockAnalyze(designType as DesignType, image.length % 997));
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Server is missing OPENROUTER_API_KEY. Add it to .env.local and restart." },
      { status: 503 },
    );
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://prismo.local",
        "X-Title": "Prismo",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: instruction(designType) },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { error: `Model request failed (${res.status})`, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const analysis = coerce(extractJson(content));
    return Response.json(analysis);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
