import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phaser uses browser-only globals (window, document, Audio, Canvas).
  // Keep it out of the server bundle so it is never evaluated on the server.
  // This is the Turbopack-native equivalent of externalizing it in webpack.
  serverExternalPackages: ["phaser"],
};

export default nextConfig;
