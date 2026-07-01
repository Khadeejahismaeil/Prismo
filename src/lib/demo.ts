import type { Analysis, Source } from "./types";

/**
 * Self-contained demo path — a preset "before" design, a canned analysis, and a
 * preset "after" redesign. Runs with NO API calls or credits, so it's reliable
 * for a live presentation. Same content in before/after, only the styling improves.
 */

const BEFORE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;font-family:system-ui,sans-serif}
body{background:#fff;padding:16px;color:#111}
.top{display:flex;justify-content:space-between;align-items:center}
.title{font-size:18px;font-weight:600}
.sub{color:#cccccc;font-size:12px}
.bal{margin-top:14px;background:#f4f4f4;padding:14px;border-radius:8px}
.bal .l{color:#cccccc;font-size:12px}
.bal .v{font-size:24px;font-weight:700}
.field{margin-top:12px}
.field label{color:#cccccc;font-size:12px}
.field input{width:100%;padding:8px;border:1px solid #dddddd;border-radius:6px;font-size:16px}
.row{display:flex;gap:8px;margin-top:12px}
.row .field{flex:1;margin-top:0}
.btn{margin-top:16px;width:100%;background:#33bb77;color:#fff;border:0;padding:12px;border-radius:6px;font-size:15px}
.recent{margin-top:16px}
.recent h3{font-size:13px}
.tx{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #eeeeee}
.tx .n{color:#cccccc}
</style></head><body>
<div class="top"><div class="title">Send money</div><div class="sub">Sam</div></div>
<div class="bal"><div class="l">Available balance</div><div class="v">$4,820.50</div></div>
<div class="field"><label>Amount</label><input value="$120.00"></div>
<div class="row"><div class="field"><label>From</label><input value="Checking"></div><div class="field"><label>To</label><input value="Alex R."></div></div>
<button class="btn">Send</button>
<div class="recent"><h3>Recent</h3>
<div class="tx"><span>Alex R.</span><span class="n">-$45</span></div>
<div class="tx"><span>Jordan P.</span><span class="n">-$18</span></div>
<div class="tx"><span>Payroll</span><span class="n">+$3,100</span></div>
</div>
</body></html>`;

export const DEMO_AFTER_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;font-family:system-ui,-apple-system,sans-serif}
body{background:#f6f7fb;color:#0e1726;padding:22px 18px}
.top{display:flex;justify-content:space-between;align-items:center}
.title{font-size:22px;font-weight:800;letter-spacing:-.02em}
.sub{color:#5b6675;font-size:13px;margin-top:2px}
.av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#8fb8ff,#2f6df6)}
.bal{margin-top:20px;background:linear-gradient(135deg,#1b2a4a,#2f6df6);color:#fff;border-radius:20px;padding:20px}
.bal .l{opacity:.85;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.bal .v{font-size:34px;font-weight:800;letter-spacing:-.03em;margin-top:6px}
.field{margin-top:16px}
.field label{color:#0e1726;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.field input{width:100%;margin-top:6px;padding:14px;border:1px solid #e2e6ee;border-radius:14px;font-size:17px;background:#fff}
.row{display:flex;gap:12px;margin-top:16px}
.row .field{flex:1;margin-top:0}
.btn{margin-top:22px;width:100%;background:#2f6df6;color:#fff;border:0;padding:16px;border-radius:14px;font-size:16px;font-weight:700}
.recent{margin-top:22px}
.recent h3{font-size:14px;margin-bottom:8px}
.tx{display:flex;justify-content:space-between;align-items:center;font-size:14px;padding:12px 0;border-bottom:1px solid #eef1f6}
.tx .n{font-weight:700}
.tx .neg{color:#0e1726}.tx .pos{color:#179a5b}
</style></head><body>
<div class="top"><div><div class="title">Send money</div><div class="sub">Good morning, Sam</div></div><div class="av"></div></div>
<div class="bal"><div class="l">Available balance</div><div class="v">$4,820.50</div></div>
<div class="field"><label>Amount</label><input value="$120.00"></div>
<div class="row"><div class="field"><label>From</label><input value="Checking"></div><div class="field"><label>To</label><input value="Alex R."></div></div>
<button class="btn">Send $120.00</button>
<div class="recent"><h3>Recent</h3>
<div class="tx"><span>Alex R.</span><span class="n neg">-$45</span></div>
<div class="tx"><span>Jordan P.</span><span class="n neg">-$18</span></div>
<div class="tx"><span>Payroll</span><span class="n pos">+$3,100</span></div>
</div>
</body></html>`;

export const DEMO_SOURCE: Source = { kind: "html", payload: BEFORE_HTML };

export const DEMO_ANALYSIS: Analysis = {
  id: "demo",
  score: 68,
  headline: "Solid bones, needs polish",
  summary: "The task is clear, but faint text and a flat layout make it feel unfinished.",
  purpose: "A mobile banking 'send money' screen for quick everyday transfers.",
  sourceKind: "html",
  viewport: { w: 390, h: 844 },
  strengths: ["Clear primary task", "Familiar layout", "Readable amounts"],
  metrics: { contrastFailRate: 0.5, textElements: 8, palette: [] },
  issues: [
    {
      id: "i0",
      title: "Faint labels",
      explanation: "Light grey labels on white are hard to read.",
      why: "Users skim these to trust the transfer.",
      severity: "high",
      x: 26,
      y: 18,
      measured: true,
      metric: "1.6:1 (needs 4.5:1)",
      solutions: [
        { id: "a", label: "Darken the text", detail: "Use a near-black for labels." },
        { id: "b", label: "Use a mid-grey", detail: "At least #5b6675 for AA." },
      ],
    },
    {
      id: "i1",
      title: "Flat balance",
      explanation: "The balance blends into the page with no emphasis.",
      why: "It's the anchor of this screen.",
      severity: "medium",
      x: 50,
      y: 22,
      solutions: [
        { id: "a", label: "Feature the balance", detail: "Give it a bold accent card." },
        { id: "b", label: "Bigger numerals", detail: "Increase size and weight." },
      ],
    },
    {
      id: "i2",
      title: "Generic button",
      explanation: "The plain green button lacks weight and clarity.",
      why: "It's the one action that matters.",
      severity: "medium",
      x: 50,
      y: 56,
      solutions: [
        { id: "a", label: "Stronger primary", detail: "Brand color, larger tap area." },
        { id: "b", label: "Confirm the amount", detail: "Label it 'Send $120.00'." },
      ],
    },
    {
      id: "i3",
      title: "Tight spacing",
      explanation: "Fields and rows sit too close together.",
      why: "Breathing room aids scanning and taps.",
      severity: "low",
      x: 50,
      y: 40,
      solutions: [
        { id: "a", label: "Add vertical rhythm", detail: "Consistent 16px gaps." },
        { id: "b", label: "Pad the inputs", detail: "Taller fields, rounded corners." },
      ],
    },
  ],
};
