import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⭐ 必须：让 next build 产出 .next/standalone
  output: "standalone",

  reactCompiler: true,

  images: {
    remotePatterns: [
      // local backend
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },

      // production / staging images
      {
        protocol: "https",
        hostname: "example.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
