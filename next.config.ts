import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy all /api/proxy/* requests to the backend server.
  // The browser calls /api/proxy/... (same origin → no CORS preflight).
  // Next.js forwards the request server-side to the real backend URL.
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
