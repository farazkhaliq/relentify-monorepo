const path = require('path')
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ["@relentify/ui", "@relentify/database", "@relentify/auth", "@relentify/config", "@relentify/utils"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
module.exports = nextConfig
