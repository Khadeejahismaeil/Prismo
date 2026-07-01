/**
 * Generate an improved version of a design as a self-contained HTML document.
 * Sends the original screenshot + the user's chosen fixes to the model and asks
 * it to recreate the screen, faithful to the real content, with the fixes and
 * good design principles applied. Returns { html } to render live in a
 * sandboxed iframe. Key stays server-side.
 */

import { inspectImage, NOT_RASTER_MESSAGE } from "@/lib/image";
import { callVision, missingKeyMessage, providerKeyPresent } from "@/lib/ai";

const SYSTEM = `You are a senior product designer and front-end engineer. You recreate a UI screen from a screenshot as a single self-contained HTML document, faithfully preserving its real content (text, numbers, labels, structure) so it is recognizably the same screen, then apply specific requested improvements and strong visual-design principles (distinctiveness over templated defaults, intentional typography, clear hierarchy, restraint). You output only HTML.`;

type Fix = { title?: string; label?: string; detail?: string };

function instruction(designType: string, fixes: Fix[]) {
  const list = fixes.length
    ? fixes.map((f) => `- ${f.title}: ${f.label}${f.detail ? ` (${f.detail})` : ""}`).join("\n")
    : "- Tighten hierarchy, spacing, and contrast with restraint.";
  return `Recreate this ${designType} screen as ONE self-contained HTML document.

Keep the real content from the screenshot: the same headings, labels, numbers and overall structure, so it is clearly the same screen, improved.

Apply these specific improvements:
${list}

Requirements:
- Inline <style> only. No external fonts, images, scripts, or frameworks. No JavaScript.
- Use system fonts (font-family: system-ui, -apple-system, sans-serif).
- A polished mobile screen that fills the viewport: html,body { margin:0; height:100%; }. Responsive, no horizontal scroll.
- Make it look intentional and distinctive, not templated.
- Output ONLY the HTML document, starting with <!doctype html>. No markdown fences, no commentary.`;
}

function extractHtml(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  let body = (fenced ? fenced[1] : text).trim();
  const lower = body.toLowerCase();
  const start = Math.max(lower.indexOf("<!doctype"), lower.indexOf("<html"));
  if (start > 0) body = body.slice(start);
  return body;
}

const MOCK_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--ink:#16202b;--muted:#6b7785;--brand:#2f6df6;--surface:#f4f7fb}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:system-ui,-apple-system,sans-serif;color:var(--ink);background:#fff;padding:22px 18px}
.top{display:flex;justify-content:space-between;align-items:center}
.top h1{font-size:22px;margin:0;letter-spacing:-.02em}
.top .sub{color:var(--muted);font-size:12px;margin-top:2px}
.av{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#bcd2ff,#2f6df6)}
.bal{margin-top:18px;background:linear-gradient(135deg,#1b2a4a,#2f6df6);color:#fff;border-radius:22px;padding:22px}
.bal .lab{font-size:12px;opacity:.8}
.bal .amt{font-size:34px;font-weight:800;letter-spacing:-.03em;margin-top:6px}
.bal .delta{font-size:12px;opacity:.85;margin-top:6px}
.row{display:flex;gap:12px;margin-top:14px}
.stat{flex:1;background:var(--surface);border-radius:18px;padding:14px}
.stat .lab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.stat .v{font-size:20px;font-weight:700;margin-top:4px}
h2{font-size:14px;margin:22px 0 10px}
.tx{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eef1f5}
.dot{width:34px;height:34px;border-radius:11px;background:var(--surface)}
.tx .name{font-size:14px;font-weight:600}
.tx .when{font-size:11px;color:var(--muted)}
.tx .amt{margin-left:auto;font-weight:700}
.amt.neg{color:#16202b}.amt.pos{color:#179a5b}
.cta{margin-top:22px;width:100%;border:0;border-radius:16px;padding:16px;background:var(--brand);color:#fff;font-size:15px;font-weight:700}
</style></head><body>
<div class="top"><div><h1>Lumi</h1><div class="sub">Good morning, Sam</div></div><div class="av"></div></div>
<div class="bal"><div class="lab">Total balance</div><div class="amt">$4,820.50</div><div class="delta">▲ 2.4% this month</div></div>
<div class="row"><div class="stat"><div class="lab">Income</div><div class="v">$6,200</div></div><div class="stat"><div class="lab">Spending</div><div class="v">$1,380</div></div></div>
<h2>Recent</h2>
<div class="tx"><div class="dot"></div><div><div class="name">Groceries</div><div class="when">Today</div></div><div class="amt neg">-$54</div></div>
<div class="tx"><div class="dot"></div><div><div class="name">Coffee</div><div class="when">Today</div></div><div class="amt neg">-$6</div></div>
<div class="tx"><div class="dot"></div><div><div class="name">Salary</div><div class="when">Yesterday</div></div><div class="amt pos">+$3,100</div></div>
<button class="cta">Add transaction</button>
</body></html>`;

export async function POST(req: Request) {
  let image = "";
  let designType = "Mobile app";
  let fixes: Fix[] = [];
  try {
    const body = await req.json();
    image = body.image ?? "";
    designType = body.designType ?? "Mobile app";
    fixes = Array.isArray(body.fixes) ? body.fixes : [];
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "No image provided" }, { status: 400 });

  const info = inspectImage(image);
  console.log(`[improve] image ${info.kind} ${info.mime ?? "?"} ~${info.kb ?? "?"}KB raster=${info.isRaster}`);

  // Test path: return a sample improved screen without calling the model.
  if (process.env.USE_MOCK_ANALYSIS === "1") {
    await new Promise((r) => setTimeout(r, 1200));
    return Response.json({ html: MOCK_HTML });
  }

  if (!info.isRaster) {
    return Response.json({ error: NOT_RASTER_MESSAGE }, { status: 415 });
  }

  if (!providerKeyPresent()) {
    return Response.json({ error: missingKeyMessage() }, { status: 503 });
  }

  try {
    const content = await callVision({
      system: SYSTEM,
      prompt: instruction(designType, fixes),
      imageDataUrl: image,
      maxTokens: 4000,
      temperature: 0.5,
    });
    const html = extractHtml(content);
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
      return Response.json({ error: "Model did not return HTML" }, { status: 502 });
    }
    return Response.json({ html });
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError"
      ? "The redraw took too long. Free models can be slow, try again."
      : e instanceof Error
        ? e.message
        : "Generation failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
