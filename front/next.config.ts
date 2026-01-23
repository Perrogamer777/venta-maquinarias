import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/chatbot/:path*',
        destination: 'https://reservas-whatsapp-918499479162.us-central1.run.app/api/:path*',
      },
    ]
  },
};

export default nextConfig;
