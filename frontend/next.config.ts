import type { NextConfig } from "next";

// When set (on Vercel), the browser calls /api on this site and Next.js forwards it to the API.
// The auth cookie then stays on one domain, so browsers send it with every request.
const apiProxyUrl = process.env.API_PROXY_URL;

const nextConfig: NextConfig = {
  // Produces a small self-contained server for the Docker image.
  output: "standalone",
  // With the proxy on, the browser calls this site's own /api (lib/api.ts adds the /api part).
  ...(apiProxyUrl && { env: { NEXT_PUBLIC_API_URL: "" } }),
  async rewrites() {
    return apiProxyUrl ? [{ source: "/api/:path*", destination: `${apiProxyUrl}/api/:path*` }] : [];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
