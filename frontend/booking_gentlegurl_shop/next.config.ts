import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⭐ 必须：让 next build 产出 .next/standalone
  output: "standalone",

  reactCompiler: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.gentlegurls.com",
        pathname: "/**",
      },
      // local backend
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      // Also allow 127.0.0.1 for localhost resolution
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/**",
      },
      // Also allow IPv6 localhost
      {
        protocol: "http",
        hostname: "[::1]",
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
    // Disable image optimization in development to avoid private IP issues with localhost
    // This allows loading images from http://localhost:8000 without the "resolved to private ip" error
    unoptimized: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;
