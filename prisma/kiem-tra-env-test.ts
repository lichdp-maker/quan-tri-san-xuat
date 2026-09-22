/**
 * Chạy TRƯỚC `prisma migrate deploy` của lệnh npm run db:test.
 *
 * Prisma báo lỗi kết nối bằng mã P1000 rất khó đoán nguyên nhân. Script này nói
 * thẳng sai ở đâu và phải làm gì, trước khi Prisma kịp thử kết nối.
 */
import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { kiemTraUrlCsdlTest, cheMatKhau } from '../lib/kiem-url-csdl'

const TEP = '.env.test'

if (!existsSync(TEP)) {
  console.error(`
Chưa có tệp ${TEP} ở thư mục gốc dự án.

Tạo tệp ${TEP} với nội dung (thay bằng chuỗi THẬT của nhánh test trên Neon):

  DATABASE_URL="postgresql://..."
  DIRECT_URL="postgresql://..."

Lấy chuỗi thật: Neon Console > dự án > nút Connect > ô Branch chọn nhánh test > Copy.
Chi tiết trong docs/env-test-mau.md.
`)
  process.exit(1)
}

config({ path: TEP, override: true })

const kq = kiemTraUrlCsdlTest(process.env.DATABASE_URL, TEP)
if (!kq.ok) {
  console.error(`\n${kq.loi}\n`)
  process.exit(1)
}

if (!process.env.DIRECT_URL) {
  console.error(`\nTệp ${TEP} thiếu DIRECT_URL. Đặt cùng chuỗi với DATABASE_URL.\n`)
  process.exit(1)
}

console.log(`Sẽ đưa migration lên: ${cheMatKhau(process.env.DATABASE_URL!)}`)
