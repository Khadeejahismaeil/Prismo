/**
 * A built-in sample screenshot (a fictional "Lumi" budgeting app) so the flow
 * is demoable without uploading. It's a real raster PNG in /public so vision
 * models can actually parse it (SVG cannot be read by vision models).
 */
export const SAMPLE_SCREEN_SRC = "/sample.png";

/** Fetch the sample PNG and return it as a data URL (what the model needs). */
export async function loadSampleDataUrl(): Promise<string> {
  const res = await fetch(SAMPLE_SCREEN_SRC);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't load the sample image"));
    reader.readAsDataURL(blob);
  });
}
