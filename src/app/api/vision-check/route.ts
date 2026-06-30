import { inspectImage } from "@/lib/image";

/**
 * Debug endpoint: confirms the model can actually SEE the uploaded image.
 * POST { image } -> { saw, info }. `saw` is the model's literal description;
 * if it returns NO_IMAGE the model isn't receiving/parsing the picture.
 */
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-opus-4.1";

export async function POST(req: Request) {
  let image = "";
  let model = MODEL;
  try {
    const body = await req.json();
    image = body.image ?? "";
    if (body.model) model = body.model;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "No image provided" }, { status: 400 });

  const info = inspectImage(image);

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "Missing OPENROUTER_API_KEY", info }, { status: 503 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45_000);
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
        model,
        temperature: 0,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Look at this image. List the exact visible text strings and UI elements you can see, in a short comma-separated list. If you cannot see any image at all, reply with exactly: NO_IMAGE",
              },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json(
        { error: `Model error (${res.status})`, detail: JSON.stringify(data).slice(0, 400), info },
        { status: 502 },
      );
    }
    const saw: string = data?.choices?.[0]?.message?.content ?? "";
    return Response.json({ model, info, saw });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Vision check failed", info },
      { status: 500 },
    );
  } finally {
    clearTimeout(t);
  }
}
