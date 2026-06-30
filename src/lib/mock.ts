import type { Analysis, DesignType, Issue, Severity } from "./types";

/**
 * A believable mock review. In production this is where the OpenRouter
 * vision call would go. Each issue offers a few alternative fixes the user can
 * choose between (or discard), and not every design needs fixing, strong
 * designs come back clean.
 */

type IssueSeed = Omit<Issue, "id">;

const POOL: IssueSeed[] = [
  {
    title: "Flat hierarchy",
    explanation: "Nothing leads the eye first.",
    severity: "high",
    x: 32,
    y: 20,
    solutions: [
      { id: "a", label: "Enlarge the headline", detail: "Bigger, heavier title.", filter: "contrast(1.08)" },
      { id: "b", label: "Add a color accent", detail: "Tint the title in brand.", filter: "saturate(1.2)" },
      { id: "c", label: "Add an eyebrow label", detail: "Small label above it." },
    ],
  },
  {
    title: "CTA blends in",
    explanation: "The main action is easy to miss.",
    severity: "high",
    x: 70,
    y: 74,
    solutions: [
      { id: "a", label: "Solid brand fill", detail: "Fill it with brand color.", filter: "saturate(1.22) contrast(1.05)" },
      { id: "b", label: "High-contrast outline", detail: "Bold outline, dark label.", filter: "contrast(1.14)" },
      { id: "c", label: "Raise it up", detail: "Move it into view sooner." },
    ],
  },
  {
    title: "Low contrast",
    explanation: "Grey on light dips below AA.",
    severity: "medium",
    x: 26,
    y: 52,
    solutions: [
      { id: "a", label: "Darken the text", detail: "Use #4A4A4A for AA.", filter: "contrast(1.14) brightness(0.98)" },
      { id: "b", label: "Lighten the bg", detail: "Brighter surface behind.", filter: "brightness(1.06)" },
    ],
  },
  {
    title: "Uneven spacing",
    explanation: "Section gaps feel restless.",
    severity: "medium",
    x: 74,
    y: 34,
    solutions: [
      { id: "a", label: "Snap to 8-pt grid", detail: "One spacing rhythm.", filter: "contrast(1.04)" },
      { id: "b", label: "Group related items", detail: "Tight in, loose between." },
    ],
  },
  {
    title: "Tight tap targets",
    explanation: "A few areas are under 44px.",
    severity: "low",
    x: 48,
    y: 86,
    solutions: [
      { id: "a", label: "Pad to 44px", detail: "Hit the min target size." },
      { id: "b", label: "Add row spacing", detail: "More space between rows." },
    ],
  },
  {
    title: "Crowded top",
    explanation: "Too much competes up top.",
    severity: "medium",
    x: 54,
    y: 14,
    solutions: [
      { id: "a", label: "Add white space", detail: "Let the header breathe.", filter: "brightness(1.04)" },
      { id: "b", label: "Remove one item", detail: "Drop the least useful." },
      { id: "c", label: "Collapse to a menu", detail: "Tuck extras away." },
    ],
  },
];

const STRENGTHS = [
  "Consistent color palette",
  "Clean, modern type",
  "Comfortable white space",
  "Friendly iconography",
  "Cohesive components",
  "Solid grid alignment",
];

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function issueCount(score: number, seed: number): number {
  if (score >= 92) return 0; // strong enough to ship as-is
  if (score >= 86) return 1 + (seed % 2); // 1–2
  return 2 + (seed % 3); // 2–4
}

export function analyze(designType: DesignType, seed = 1): Analysis {
  const score = 70 + (seed % 29); // 70–98
  const count = issueCount(score, seed);

  const issues = shuffle(POOL, seed)
    .slice(0, count)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .map((s, i) => ({ ...s, id: `i${i}` }));

  const strengths = shuffle(STRENGTHS, seed + 7).slice(0, count === 0 ? 4 : 3);

  const clean = count === 0;
  const headline = clean
    ? "A stunner ✨"
    : score >= 86
      ? "Really strong, nice eye!"
      : score >= 78
        ? "Solid start, lots to love."
        : "Great bones to build on.";

  const summary = clean
    ? "Couldn't find a thing to fix. Ship it with confidence."
    : score >= 85
      ? "Close to ship-ready. Pick a fix for each below."
      : "A few tweaks lift this fast. Pick a fix for each.";

  return { id: `a${seed}`, score, headline, summary, strengths, issues };
}

export const LOADING_MESSAGES = [
  "Munching on the details…",
  "Checking hierarchy…",
  "Measuring spacing…",
  "Tasting the contrast…",
  "Spotting the CTA…",
  "One more second…",
];
