const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ["@relentify/ui", "@relentify/database", "@relentify/config", "@relentify/utils"],
};

module.exports = nextConfig;
