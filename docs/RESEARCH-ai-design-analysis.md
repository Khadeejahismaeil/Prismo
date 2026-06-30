# AI Design Analysis — Research Findings & Architecture

_Deep-research pass (27 sources, 25 claims verified 3-vote adversarial; 23 confirmed, 2 refuted). Verified June 2026 — re-check vendor pricing before committing._

## TL;DR

Build a **hybrid pipeline**: deterministic tools compute the hard numbers (contrast, spacing,
tap-targets, hierarchy), the vision LLM only **critiques and orchestrates — never measures**.
Pin every annotation with **Set-of-Marks** (numbered boxes), not raw x/y coordinates. Treat
measured facts as trustworthy; treat LLM critique as best-effort suggestion.

## Why the current approach is risky (reality checks)

- A vision LLM alone is a **weak heuristic evaluator**: GPT-4o reproduced only **21.2%** of
  expert-identified usability issues (14/66) and adds a substantial rate of hallucinated
  issues. [arXiv:2506.16345]
- Vision LLMs are **bad at pixel-precise localization** — asking for raw x/y is the wrong move.
- LLM "judges" carry documented biases (position, verbosity, self-enhancement, authority) and
  are highly **prompt-template sensitive** → scores drift. [arXiv:2412.05579]

➡️ Conclusion: measured numbers must drive the verdict; the LLM synthesizes and explains.

## Verified building blocks

### 1. Coordinate grounding — Set-of-Marks (SoM)
Overlay numbered boxes on detected elements and have the model reference **box IDs**, not
coordinates. Adding structured parsing raised GPT-4V ScreenSpot grounding **16.2% → 73.0%**.
- **OmniParser** (Microsoft) — production screen-parser: YOLOv8 finetuned on ~67k screenshots
  whose boxes were derived from the DOM trees of 100k popular URLs. [arXiv:2408.00203]
- General SoM (SEEM/SAM masks + marks) is model-agnostic. [arXiv:2310.11441]
- ⚠️ Models can still mis-assign IDs when many boxes are present.

### 2. Direct prior art for Prismo's exact use case
"Visual Prompting with Iterative Refinement for Design Critique Generation" (Dec 2024) —
generates critique comments **each paired with a bounding box**, on Gemini-1.5-pro / GPT-4o,
iteratively refining text + boxes. Authors note MLLMs "often struggle" with grounded critique
→ refinement needed. [arXiv:2412.16829] Companion dataset **UICrit**: 3,059 expert critiques +
ratings over 983 mobile UIs, each with a localizing bounding box. [arXiv:2407.08850]

### 3. Deterministic measurement (the trustworthy core)
- **WCAG contrast** — trivial formula; ship as a hard number, not an LLM guess.
  Reference impl `wcag-contrast-ratio` (returns 1.0–21.0, `passes_AA/AAA`). [github/gsnedders]
- **Visual hierarchy / focal point** — **UMSI** (MIT/Adobe), predicts visual-importance
  heatmaps, **trained on mobile UIs** (not just photos). Derive hierarchy metrics from the
  heatmap. [predimportance.mit.edu, arXiv:2008.02912]
- _Standard-but-not-independently-verified here_ (use, but treat as conventional): k-means
  palette extraction; OpenCV layout/spacing/alignment detection; OCR (Tesseract/PaddleOCR) for
  font-size distribution & reading order; tap-target thresholds; RICO/UIED datasets;
  Lighthouse/WAVE.

### 4. Source-based analysis (when more than a screenshot exists)
- **axe-core** (MPL-2.0) — WCAG 2.0/2.1/2.2 A/AA/AAA + 508/EN 301 549 on live HTML, designed
  for **zero false positives** (uncertain → "incomplete"). No native-mobile support; needs a
  real DOM. [deque.com/axe]
- **Figma REST API** — exact ground-truth tokens (color/spacing/type via Variables endpoints)
  and component specs; read-only. Far more reliable than visual inference. [developers.figma.com]

### 5. Reliability & orchestration
- **Structured outputs / JSON-schema / function-calling** to guarantee valid output.
- **Multi-pass decomposition** (separate contrast / hierarchy / copy passes) beats one mega-prompt.
- **Feed measured numbers into the prompt** instead of asking the model to estimate.

### 6. Model / cost (indie builder)
- **Gemini = best free-tier/BYOK path** (verified): via Google AI Studio, genuine free tier
  (free in/out tokens, no spend-based limits; data used to improve Google products). Paid:
  2.5 Flash-Lite **$0.10/$0.40**, Flash **$0.30/$2.50**, Pro **$1.25/$10** per 1M tokens; image
  billed at text rate. Free tier excluded in EEA/UK/CH for user-facing clients. [ai.google.dev]
- For comparison (secondary sources, not adversarially verified here): Claude Opus ≈ $5/$25,
  Gemini Pro ≈ $2/$12, Qwen2.5-VL outputs bounding boxes in standardized JSON.

### Refuted (do NOT cite)
ScreenSpot-Pro figures "OS-Atlas-7B 18.9%" and "GPT-4o 0.8%" — failed verification.

## Recommended architecture for Prismo

```
upload PNG
   │
   ├─► DETERMINISTIC LAYER (Node, runs first — these are FACTS)
   │     • OCR (tesseract.js) → text boxes + sizes  → hierarchy, reading order
   │     • sharp pixel sampling around each text box → WCAG contrast per element
   │     • palette extraction (node-vibrant) → consistency
   │     • box sizes → tap-target < 44px flags
   │     → produces a metrics table + element boxes
   │
   ├─► SET-OF-MARKS: overlay numbered boxes on the image
   │
   └─► VISION LLM (Gemini Flash, JSON schema)
         input: marked image + metrics table
         job: qualitative critique + pick the top issues, referencing BOX IDs
         → annotations snap to real elements; measured claims come from the table, not the model
```

**Score** = mostly deterministic (contrast pass-rate, tap-target compliance, hierarchy from
UMSI, palette consistency) + a small LLM-judged "craft" component, to avoid LLM-judge bias.

## Phasing (effort vs payoff)

- **Phase 1 (Node-only, no ML sidecar):** tesseract.js + sharp contrast + palette + tap-target
  + lightweight SoM from OCR boxes; switch to Gemini Flash BYOK with JSON schema. → real
  measured contrast/sizes + precise-ish circles. _High payoff, all npm packages._
- **Phase 2:** add a Python sidecar for UMSI saliency (hierarchy) and OmniParser (better SoM).
- **Phase 3:** source mode — paste a URL → headless render + axe-core; or Figma file → REST API.
