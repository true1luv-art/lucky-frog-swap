import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node.js-only packages (mongoose, mongodb, node-schedule) out of the
  // browser bundle. These must only ever run in API routes and Server Components.
  serverExternalPackages: ["mongoose", "mongodb", "node-schedule"],

  // Phaser ships as an ESM package — Next.js needs to transpile it so the
  // CJS/ESM interop works correctly in the browser bundle.
  transpilePackages: ["phaser"],
};

export default nextConfig;
