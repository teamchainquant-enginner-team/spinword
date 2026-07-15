/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: ".next16",
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
