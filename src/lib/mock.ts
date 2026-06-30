import type { Analysis, DesignType, Issue, Severity } from "./types";

/**
 * A believable mock review. In production this is where the OpenRouter
 * vision call would go. Each issue offers a few alternative fixes the user can
 * choose between (or discard), and not every design needs fixing — strong
 * designs come back clean.
 */

type IssueSeed = Omit<Issue, "id">;

const POOL: IssueSeed[] = [
  {
    title: "Visual hierarchy is flat",
    explanation:
      "The most important element doesn't stand out — the eye doesn't know where to land first.",
    severity: "high",
    x: 32,
    y: 20,
    solutions: [
      { id: "a", label: "Enlarge the headline", detail: "Scale the key title up and make it heavier.", filter: "contrast(1.08)" },
      { id: "b", label: "Add a color accent", detail: "Tint the primary title with the brand color.", filter: "saturate(1.2)" },
      { id: "c", label: "Add an eyebrow label", detail: "A small caps label above anchors the section." },
    ],
  },
  {
    title: "Primary CTA blends in",
    explanation:
      "Your main action looks like everything around it, so it's easy to miss.",
    severity: "high",
    x: 70,
    y: 74,
    solutions: [
      { id: "a", label: "Solid brand fill", detail: "Fill the button with the brand gradient.", filter: "saturate(1.22) contrast(1.05)" },
      { id: "b", label: "High-contrast outline", detail: "Bold outline with a darker label.", filter: "contrast(1.14)" },
      { id: "c", label: "Raise it up the page", detail: "Move the CTA so it's seen sooner." },
    ],
  },
  {
    title: "Low text contrast",
    explanation:
      "Light grey on a light background dips below the AA accessibility ratio.",
    severity: "medium",
    x: 26,
    y: 52,
    solutions: [
      { id: "a", label: "Darken the body text", detail: "Bump text to #4A4A4A for comfortable AA.", filter: "contrast(1.14) brightness(0.98)" },
      { id: "b", label: "Lighten the background", detail: "Raise the surface lightness behind text.", filter: "brightness(1.06)" },
    ],
  },
  {
    title: "Inconsistent spacing",
    explanation:
      "Gaps between sections vary, which makes the layout feel a little restless.",
    severity: "medium",
    x: 74,
    y: 34,
    solutions: [
      { id: "a", label: "Snap to an 8-pt grid", detail: "Align all padding to an 8-pt rhythm.", filter: "contrast(1.04)" },
      { id: "b", label: "Group related items", detail: "Tighten within groups, widen between them." },
    ],
  },
  {
    title: "Touch targets feel tight",
    explanation:
      "A couple of tap areas are under 44px, which can be fiddly on a phone.",
    severity: "low",
    x: 48,
    y: 86,
    solutions: [
      { id: "a", label: "Pad to 44×44px", detail: "Grow tap areas to the minimum target size." },
      { id: "b", label: "Add row spacing", detail: "More vertical space between tappable rows." },
    ],
  },
  {
    title: "Crowded top area",
    explanation:
      "Several elements compete near the top, adding cognitive load up front.",
    severity: "medium",
    x: 54,
    y: 14,
    solutions: [
      { id: "a", label: "Add white space", detail: "Let the header breathe with more room.", filter: "brightness(1.04)" },
      { id: "b", label: "Remove one element", detail: "Drop the least useful header item." },
      { id: "c", label: "Collapse into a menu", detail: "Tuck secondary actions into a menu." },
    ],
  },
];

const STRENGTHS = [
  "Lovely, consistent color palette",
  "Type pairing feels clean and modern",
  "Generous, comfortable white space",
  "Friendly, legible iconography",
  "Cohesive rounded components",
  "Solid alignment down a clear grid",
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

  const type = designType.toLowerCase();
  const clean = count === 0;
  const headline = clean
    ? "This one's a stunner ✨"
    : score >= 86
      ? "Really strong — nice eye!"
      : score >= 78
        ? "Solid start, lots to love."
        : "Great bones to build on.";

  const summary = clean
    ? `I went looking for problems across your ${type} and honestly came up empty — hierarchy, spacing, contrast and clarity are all dialed in. Ship it with confidence.`
    : `${
        score >= 85 ? "This is close to ship-ready" : "A few focused tweaks will lift this fast"
      }. I looked across your ${type} and pulled out the ${
        count === 1 ? "one change" : `${count} changes`
      } with the biggest payoff — pick the fix you like for each.`;

  return { id: `a${seed}`, score, headline, summary, strengths, issues };
}

export const LOADING_MESSAGES = [
  "Munching on the details…",
  "Checking visual hierarchy…",
  "Measuring spacing rhythm…",
  "Tasting the contrast…",
  "Spotting the main CTA…",
  "One more delicious second…",
];
