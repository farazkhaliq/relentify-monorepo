/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@relentify/ui", "@relentify/config", "@relentify/utils"],
  output: 'export' // Static Export for Marketing
};

module.exports = nextConfig;
