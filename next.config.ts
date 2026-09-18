import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // argon2 và Prisma là native/server-only, không đóng gói vào bundle
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client'],
}

export default nextConfig
