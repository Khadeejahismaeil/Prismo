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
};

export type Analysis = {
  id: string;
  score: number;
  headline: string;
  summary: string;
  strengths: string[];
  issues: Issue[];
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
