/* global process */
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mealy/types'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return {
      beforeFiles: [
        {
          source: '/api/auth/register',
          destination: `${apiUrl}/api/auth/register`,
        },
      ],
      fallback: [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
