import type { NextConfig } from 'next'

/**
 * Header bảo mật đặt ở mức máy chủ, áp cho mọi đường dẫn.
 * CSP chưa bật ở đây vì Next còn chèn script nội tuyến — sẽ làm riêng bằng
 * nonce trong middleware, không gộp vào đây để tránh chặn nhầm cả trang.
 */
const HEADER_BAO_MAT = [
  // Trình duyệt chỉ nói chuyện với site này qua HTTPS trong một năm
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Không đoán kiểu tệp — chặn một dạng tấn công qua tệp tải lên
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Không cho site khác nhúng trang này vào iframe (chống clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Hệ thống không dùng camera, micro, vị trí — tắt hẳn
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  // argon2 và Prisma là native/server-only, không đóng gói vào bundle
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client'],

  // Không để lộ phiên bản Next trong header trả về
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: HEADER_BAO_MAT }]
  },
}

export default nextConfig
