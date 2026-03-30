import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA対応の準備（next-pwaを後から追加しやすい構成）
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
  ],
};

export default nextConfig;
