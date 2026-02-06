/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Asset 404 prevention: only set basePath/assetPrefix when deploying under a subpath.
  // If unset, Next.js serves assets from /_next/static/* at root (correct for Vercel, local dev).
  // Wrong basePath causes requests to /main-app.js or /_next/... to 404.
  ...(process.env.NEXT_PUBLIC_BASE_PATH && {
    basePath: process.env.NEXT_PUBLIC_BASE_PATH,
    assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
  }),
};

module.exports = nextConfig;
