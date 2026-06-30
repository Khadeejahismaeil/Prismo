export type DesignType =
  | "Mobile app"
  | "Website"
  | "Dashboard"
  | "Slide"
  | "Pitch deck";

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
  /** True when this issue is a hard measurement (e.g. computed contrast), not LLM judgment. */
  measured?: boolean;
  /** Short measured fact shown as evidence, e.g. "2.1:1 contrast (needs 4.5:1)". */
  metric?: string;
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
  strengths: string[];
  issues: Issue[];
  /** Deterministic measurements (present when the hybrid pipeline ran). */
  metrics?: Metrics;
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
  image: string; // data URL
  analysis: Analysis;
  choices?: Choices;
};
