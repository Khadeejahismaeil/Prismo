import type { Analysis, DesignType, Source } from "./types";
import { buildIR } from "./adapters";

export type Fix = { title: string; label: string; detail: string };

/** Ask the server to generate an improved version of the design as HTML. */
export async function requestImprovement(
  source: Source,
  designType: DesignType,
  fixes: Fix[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch("/api/improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `image` kept for the raster path the improve route still expects.
      body: JSON.stringify({ source, image: source.kind === "raster" ? source.payload : undefined, designType, fixes }),
      signal: controller.signal,
    });
  } catch {
    throw new Error("The redraw timed out or the connection dropped.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let msg = `Redraw failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const { html } = (await res.json()) as { html: string };
  return html;
}

/**
 * Ask the server to review a design. For HTML/Figma sources the IR is built
 * HERE, in the browser (render + DOM measurement), and posted alongside the
 * source; raster sources are measured server-side as before.
 */
export async function requestAnalysis(
  source: Source,
  designType: DesignType,
): Promise<Analysis> {
  let ir: unknown = undefined;
  if (source.kind === "html" || source.kind === "figma") {
    try {
      ir = await buildIR(source);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Couldn't read that design file.");
    }
  }

  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, ir, designType }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }

  if (!res.ok) {
    let msg = `Review failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return (await res.json()) as Analysis;
}
