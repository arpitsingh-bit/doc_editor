/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // OneDrive can turn `.next` into a cloud-files reparse point, which makes
  // Next's cache cleanup fail on Windows. Keep disposable build output in a
  // separate ignored directory instead.
  distDir: '.next-build',
};

export default nextConfig;
