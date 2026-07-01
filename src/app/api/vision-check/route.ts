import { inspectImage } from "@/lib/image";
import { activeModel, activeProvider, callVision, missingKeyMessage, providerKeyPresent } from "@/lib/ai";

/**
 * Debug endpoint: confirms the model can actually SEE the uploaded image.
 * POST { image, model? } -> { saw, info }. `saw` is the model's literal
 * description; if it returns NO_IMAGE the model isn't parsing the picture.
 * Uses whichever provider AI_PROVIDER selects.
 */
export async function POST(req: Request) {
  let image = "";
  let model: string | undefined;
  try {
    const body = await req.json();
    image = body.image ?? "";
    if (body.model) model = body.model;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "No image provided" }, { status: 400 });

  const info = inspectImage(image);
  if (!providerKeyPresent()) return Response.json({ error: missingKeyMessage(), info }, { status: 503 });

  try {
    const saw = await callVision({
      system: "",
      prompt:
        "Look at this image. List the exact visible text strings and UI elements you can see, in a short comma-separated list. If you cannot see any image at all, reply with exactly: NO_IMAGE",
      imageDataUrl: image,
      maxTokens: 300,
      temperature: 0,
      model,
    });
    return Response.json({ provider: activeProvider(), model: model || activeModel(), info, saw });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Vision check failed", info },
      { status: 500 },
    );
  }
}
