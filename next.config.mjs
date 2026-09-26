/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // OneDrive can virtualize generated folders as Cloud Files reparse points,
  // which makes Next's cleanup fail on Windows. node_modules is already
  // excluded from sync and keeps generated type checks near their packages.
  distDir: 'node_modules/.cache/next-build',
};

export default nextConfig;
