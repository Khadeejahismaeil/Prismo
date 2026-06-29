export type DesignType =
  | "Mobile app"
  | "Website"
  | "Dashboard"
  | "Slide"
  | "Pitch deck";

export type Severity = "low" | "medium" | "high";

export type Issue = {
  id: string;
  title: string;
  explanation: string;
  suggestion: string;
  severity: Severity;
  /** Position of the circled annotation, in % of the screenshot. */
  x: number;
  y: number;
};

export type Analysis = {
  id: string;
  score: number;
  headline: string;
  summary: string;
  issues: Issue[];
};

export type HistoryEntry = {
  id: string;
  name: string;
  designType: DesignType;
  score: number;
  date: string; // ISO
  image: string; // data URL
  analysis: Analysis;
};
