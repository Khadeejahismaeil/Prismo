import type { MetadataRoute } from "next";

/**
 * Web App Manifest (Next 16 file convention). Makes Prismo installable to the
 * home screen and launch standalone. Icons live in /public.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prismo — AI design reviewer",
    short_name: "Prismo",
    description:
      "Upload a design (image, HTML/CSS, or Figma) and Prismo reviews hierarchy, spacing, contrast and CTA clarity, scores it, and shows exactly what to fix.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f2e7",
    theme_color: "#f7f2e7",
    categories: ["productivity", "design", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
