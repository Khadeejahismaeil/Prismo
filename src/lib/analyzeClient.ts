import type { Analysis, DesignType } from "./types";

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
