/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mealy/types'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }],
  },
};

export default nextConfig;
