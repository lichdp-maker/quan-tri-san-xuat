import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'

const phong = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-viet',
})

export const metadata: Metadata = {
  title: 'Theo dõi sản xuất',
  description: 'Hệ thống theo dõi sản lượng, tiến độ lệnh và năng suất theo nguyên công',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={phong.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
