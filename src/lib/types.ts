export type DesignType =
  | "Mobile App"
  | "Website"
  | "Dashboard"
  | "Presentation"
  | "Social Media Design"
  | "Poster"
  | "Other";

/** How the design entered Prismo. Drives which analysis pipeline runs. */
export type SourceKind = "raster" | "html" | "figma";

/**
 * The design under review, in its original form.
 *  - raster: payload is a data URL (PNG/JPG/WebP)
 *  - html:   payload is an HTML document string (CSS inlined)
 *  - figma:  payload is an exported Figma JSON string
 */
export type Source = { kind: SourceKind; payload: string };

export type Severity = "low" | "medium" | "high";

export type Solution = {
  id: string;
  label: string;
  detail: string;
  /** CSS filter fragment that contributes to the AI-enhanced preview. */
  filter?: string;
};

export type Issue = {
  id: string;
  title: string;
  explanation: string;
  severity: Severity;
  /** Position of the circled annotation, in % of the screenshot. */
  x: number;
  y: number;
  /** 2–3 ways to fix it; the user picks one (or discards the issue). */
  solutions: Solution[];
  /** One clause on why this matters for the design's purpose. */
  why?: string;
  /** True when a hard measurement backs this issue (shows a "Measured" badge). */
  measured?: boolean;
  /** Short measured fact shown as evidence, e.g. "2.1:1 contrast (needs 4.5:1)". */
  metric?: string;
  /** The IR node this issue references (source pipeline only). */
  nodeId?: string;
  /** True when a measurement was attempted but could not be resolved (e.g.
   *  contrast over a gradient) — shown as "couldn't measure" rather than a number. */
  incomplete?: boolean;
};

export type Metrics = {
  contrastFailRate: number; // 0..1 of detected text failing AA
  textElements: number;
  palette: { hex: string; pct: number }[];
};

export type Analysis = {
  id: string;
  score: number;
  headline: string;
  summary: string;
  /** What Prismo judged the design to be, who it's for, and its job. */
  purpose?: string;
  strengths: string[];
  issues: Issue[];
  /** Deterministic measurements (present when the hybrid pipeline ran). */
  metrics?: Metrics;
  /** Which pipeline produced this analysis. */
  sourceKind?: SourceKind;
  /** IR coordinate space (source pipeline) — lets the UI render the preview at
   *  the exact width the markers were measured against. */
  viewport?: { w: number; h: number };
};

/** A solution id, or "discarded" when the user keeps the original. */
export type Choice = string | "discarded";

export type Choices = Record<string, Choice>;

export type HistoryEntry = {
  id: string;
  name: string;
  designType: DesignType;
  score: number;
  date: string; // ISO
  /** The original design source (raster data URL, HTML, or Figma JSON). */
  source: Source;
  /** Raster preview/thumbnail. Present for raster entries and legacy history. */
  image?: string; // data URL
  analysis: Analysis;
  choices?: Choices;
};
