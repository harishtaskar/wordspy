/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/types ships as TS source consumed via workspace; transpile it.
  transpilePackages: ["@wordspy/types"],
};

export default nextConfig;
