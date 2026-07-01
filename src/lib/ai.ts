import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Provider abstraction for the vision LLM. Switch with AI_PROVIDER:
 *   AI_PROVIDER=gemini      (default) — official Google Gemini SDK, inline image
 *   AI_PROVIDER=openrouter            — OpenRouter chat completions (legacy)
 *
 * Both return the model's raw text; callers parse it exactly as before, so the
 * JSON contract of the API routes is unchanged.
 *
 * Env:
 *   GEMINI_API_KEY      required for gemini
 *   GEMINI_MODEL        default "gemini-2.5-flash"
 *   OPENROUTER_API_KEY  required for openrouter
 *   OPENROUTER_MODEL    default "anthropic/claude-opus-4.1"
 */

export type Provider = "gemini" | "openrouter";

export type VisionRequest = {
  system: string;
  prompt: string;
  /** data URL (data:image/png;base64,...) */
  imageDataUrl: string;
  maxTokens?: number;
  temperature?: number;
  /** optional per-call model override (debug) */
  model?: string;
};

/** Text-only request — no image. Used by the source (HTML/Figma) pipeline. */
export type TextRequest = {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export function activeProvider(): Provider {
  return (process.env.AI_PROVIDER || "gemini").toLowerCase() === "openrouter"
    ? "openrouter"
    : "gemini";
}

const GEMINI_DEFAULT = "gemini-2.5-flash";
const OPENROUTER_DEFAULT = "anthropic/claude-opus-4.1";

export function activeModel(): string {
  return activeProvider() === "gemini"
    ? process.env.GEMINI_MODEL || GEMINI_DEFAULT
    : process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT;
}

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

/** True if the active provider has the credentials it needs. */
export function providerKeyPresent(): boolean {
  return activeProvider() === "gemini"
    ? Boolean(geminiKey())
    : Boolean(process.env.OPENROUTER_API_KEY);
}

export function missingKeyMessage(): string {
  return activeProvider() === "gemini"
    ? "Server is missing GEMINI_API_KEY. Add it to .env.local and restart."
    : "Server is missing OPENROUTER_API_KEY. Add it to .env.local and restart.";
}

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;,]+)(?:;base64)?,([\s\S]*)$/);
  if (!m) return { mimeType: "image/png", data: "" };
  return { mimeType: m[1], data: m[2] };
}

/* ---------------- Gemini (official SDK, inline image) ---------------- */
async function geminiVision(req: VisionRequest): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error(missingKeyMessage());

  const ai = new GoogleGenAI({ apiKey });
  const { mimeType, data } = splitDataUrl(req.imageDataUrl);

  try {
    const res = await ai.models.generateContent({
      model: req.model || process.env.GEMINI_MODEL || GEMINI_DEFAULT,
      contents: [
        {
          role: "user",
          parts: [{ text: req.prompt }, { inlineData: { mimeType, data } }],
        },
      ],
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxTokens ?? 1024,
        // Flash "thinks" by default and can burn the whole output budget; the
        // structured-JSON / HTML tasks here don't need it.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return res.text ?? "";
  } catch (e) {
    throw normalizeGeminiError(e);
  }
}

/* ---------------- Gemini (official SDK, text only) ---------------- */
async function geminiText(req: TextRequest): Promise<string> {
  const apiKey = geminiKey();
  if (!apiKey) throw new Error(missingKeyMessage());

  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model: req.model || process.env.GEMINI_MODEL || GEMINI_DEFAULT,
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.4,
        maxOutputTokens: req.maxTokens ?? 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return res.text ?? "";
  } catch (e) {
    throw normalizeGeminiError(e);
  }
}

/** Turn raw Gemini SDK errors (quota JSON, etc.) into a clean user message. */
function normalizeGeminiError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    const retry = msg.match(/retry(?:Delay)?["\s:]*~?\s*([\d.]+)\s*s/i);
    const wait = retry ? ` Try again in ~${Math.ceil(Number(retry[1]))}s.` : "";
    return new Error(
      `Gemini's free tier is out of requests for now (it caps ${GEMINI_DEFAULT} at ~20/day).${wait} Options: wait for the daily reset, set GEMINI_MODEL=gemini-2.5-flash-lite for a much bigger free quota, or enable billing.`,
    );
  }
  if (/API key|API_KEY_INVALID|permission|PERMISSION_DENIED/i.test(msg)) {
    return new Error("Gemini rejected the API key. Check GEMINI_API_KEY in .env.local.");
  }
  if (/SAFETY|blocked/i.test(msg)) {
    return new Error("Gemini blocked this image or response. Try a different screenshot.");
  }
  return e instanceof Error ? e : new Error(msg);
}

/* ---------------- OpenRouter (legacy, chat completions) ---------------- */
async function openrouterVision(req: VisionRequest): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error(missingKeyMessage());

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      signal: ctrl.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://prismo.local",
        "X-Title": "Prismo",
      },
      body: JSON.stringify({
        model: req.model || process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: req.system },
          {
            role: "user",
            content: [
              { type: "text", text: req.prompt },
              { type: "image_url", image_url: { url: req.imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Model request failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- OpenRouter (legacy, text only) ---------------- */
async function openrouterText(req: TextRequest): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error(missingKeyMessage());

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      signal: ctrl.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://prismo.local",
        "X-Title": "Prismo",
      },
      body: JSON.stringify({
        model: req.model || process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 1024,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Model request failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/** Send a system prompt + text prompt + one inline image, get the raw text back. */
export async function callVision(req: VisionRequest): Promise<string> {
  return activeProvider() === "gemini" ? geminiVision(req) : openrouterVision(req);
}

/** Send a system prompt + text prompt (no image), get the raw text back. */
export async function callText(req: TextRequest): Promise<string> {
  return activeProvider() === "gemini" ? geminiText(req) : openrouterText(req);
}
