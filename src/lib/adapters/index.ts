import type { IR } from "../ir";
import type { Source, SourceKind } from "../types";
import { extractIRFromHtml } from "../render/htmlIR";
import { parseFigma } from "./figma";

/**
 * Client-side dispatcher: turn a Source into an IR. Raster inputs do NOT build
 * an IR — they take the legacy pixel pipeline on the server.
 */
export async function buildIR(source: Source): Promise<IR> {
  switch (source.kind) {
    case "html":
      return extractIRFromHtml(source.payload);
    case "figma":
      return parseFigma(JSON.parse(source.payload));
    case "raster":
      throw new Error("Raster sources are analysed server-side, not via the IR.");
  }
}

/** Best-effort sniff of a pasted/loaded string when the file extension is unknown. */
export function detectSourceKind(text: string): Exclude<SourceKind, "raster"> {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const v = parsed as Record<string, unknown>;
      const root = (v.document ?? v) as Record<string, unknown>;
      if (root && ("absoluteBoundingBox" in root || "children" in root)) return "figma";
    } catch {
      /* not JSON — fall through to html */
    }
  }
  return "html";
}
