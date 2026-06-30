import type { Analysis, DesignType } from "./types";

export type Fix = { title: string; label: string; detail: string };

/** Ask the server to generate an improved version of the design as HTML. */
export async function requestImprovement(
  image: string,
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
      body: JSON.stringify({ image, designType, fixes }),
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

/** Ask the server route to review a screenshot. Throws with a friendly message. */
export async function requestAnalysis(
  image: string,
  designType: DesignType,
): Promise<Analysis> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, designType }),
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
