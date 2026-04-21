import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.2.2 + WASM バインディングの既知バグ回避
  // TypeScript検査は `npm run tsc` で別途実行
  typescript: { ignoreBuildErrors: true },
  // eslint: { ignoreDuringBuilds: true }, // NextConfig v16ではサポート外
};

export default nextConfig;
