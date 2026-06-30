import { inspectImage } from "@/lib/image";
import { measureDesign } from "@/lib/measure";
import { buildMarks } from "@/lib/marks";

/**
 * Debug: run only the deterministic measurement layer (OCR + contrast +
 * palette) and the Set-of-Marks overlay — no LLM. POST { image, marks? }.
 */
export async function POST(req: Request) {
  let image = "";
  let withMarks = false;
  try {
    const body = await req.json();
    image = body.image ?? "";
    withMarks = Boolean(body.marks);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!image) return Response.json({ error: "No image" }, { status: 400 });

  const info = inspectImage(image);
  if (!info.isRaster) return Response.json({ error: "Not a raster image", info }, { status: 415 });

  try {
    const buffer = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
    const m = await measureDesign(buffer);
    const marks = withMarks
      ? await buildMarks(buffer, m.width, m.height, [...m.elements].sort((a, b) => b.fontPx - a.fontPx).slice(0, 16))
      : null;
    return Response.json({
      width: m.width,
      height: m.height,
      contrastFailRate: m.contrastFailRate,
      palette: m.palette,
      elements: m.elements.map((e) => ({
        id: e.id,
        text: e.text,
        fontPx: e.fontPx,
        contrast: e.contrast,
        aa: e.aa,
        fg: e.fg,
        bg: e.bg,
      })),
      markedImage: marks?.dataUrl,
      markMap: marks?.map,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "measure failed" }, { status: 500 });
  }
}
