import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/worker-based deps out of the bundler; load them at runtime (Node).
  serverExternalPackages: ["sharp", "tesseract.js"],
};

export default nextConfig;
