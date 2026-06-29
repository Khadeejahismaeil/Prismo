import type { Analysis, DesignType, Issue, Severity } from "./types";

/**
 * A believable mock review. In production this is where the OpenRouter
 * vision call would go; here we generate constructive, encouraging feedback
 * with four spread-out annotations so the experience feels real.
 */

type IssueSeed = Omit<Issue, "id" | "x" | "y"> & { x: number; y: number };

const POOL: IssueSeed[] = [
  {
    title: "Visual hierarchy is flat",
    explanation:
      "The most important element doesn't stand out — the eye doesn't know where to land first.",
    suggestion: "Bump the key heading's size and weight, and mute secondary text.",
    severity: "high",
    x: 32,
    y: 20,
  },
  {
    title: "Primary CTA blends in",
    explanation:
      "Your main action looks like everything around it, so it's easy to miss.",
    suggestion: "Give the button a solid brand fill and more breathing room.",
    severity: "high",
    x: 70,
    y: 74,
  },
  {
    title: "Low text contrast",
    explanation:
      "Light grey on a light background dips below the AA accessibility ratio.",
    suggestion: "Darken body text to at least #4A4A4A for comfortable reading.",
    severity: "medium",
    x: 26,
    y: 52,
  },
  {
    title: "Inconsistent spacing",
    explanation:
      "Gaps between sections vary, which makes the layout feel a little restless.",
    suggestion: "Snap padding to an 8-pt scale so rhythm stays even.",
    severity: "medium",
    x: 74,
    y: 34,
  },
  {
    title: "Touch targets feel tight",
    explanation:
      "A couple of tap areas are under 44px, which can be fiddly on a phone.",
    suggestion: "Pad interactive elements to a minimum of 44×44px.",
    severity: "low",
    x: 48,
    y: 86,
  },
  {
    title: "Crowded top area",
    explanation:
      "Several elements compete near the top, adding cognitive load up front.",
    suggestion: "Let the header breathe — remove one element or add white space.",
    severity: "medium",
    x: 54,
    y: 14,
  },
];

const HEADLINES: Record<string, string> = {
  great: "Stunning work! ✨",
  good: "Really strong — nice eye!",
  ok: "Solid start, lots to love.",
  rough: "Great bones to build on.",
};

function pickHeadline(score: number) {
  if (score >= 90) return HEADLINES.great;
  if (score >= 80) return HEADLINES.good;
  if (score >= 70) return HEADLINES.ok;
  return HEADLINES.rough;
}

function summaryFor(type: DesignType, score: number) {
  const tone =
    score >= 85
      ? "This is close to ship-ready"
      : score >= 75
        ? "You're most of the way there"
        : "A few focused tweaks will lift this fast";
  return `${tone}. I looked at hierarchy, spacing, contrast and clarity across your ${type.toLowerCase()} and pulled out the four changes with the biggest payoff.`;
}

// Tiny deterministic shuffle so the same image feels consistent if re-run.
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function analyze(designType: DesignType, seed = 1): Analysis {
  const score = 72 + (seed % 21); // 72–92, encouraging range
  const issues = shuffle(POOL, seed)
    .slice(0, 4)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .map((s, i) => ({ ...s, id: `i${i}` }));

  return {
    id: `a${seed}`,
    score,
    headline: pickHeadline(score),
    summary: summaryFor(designType, score),
    issues,
  };
}

export const LOADING_MESSAGES = [
  "Munching on the details…",
  "Checking visual hierarchy…",
  "Measuring spacing rhythm…",
  "Tasting the contrast…",
  "Spotting the main CTA…",
  "One more delicious second…",
];
