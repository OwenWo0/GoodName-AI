import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @opennextjs/cloudflare 编译需要 .next/standalone 产物；对 next dev / next start 无影响
  output: 'standalone',
};

export default nextConfig;
