/**
 * Chuẩn bị môi trường cho test tích hợp.
 *
 * Chạy TRƯỚC mọi tệp test. Nhiệm vụ duy nhất: bảo đảm Prisma trỏ vào CSDL TEST,
 * và thà dừng hẳn còn hơn để nó chạm vào CSDL đang dùng thật — bộ test xoá sạch bảng.
 */
import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { kiemTraUrlCsdlTest } from '../lib/kiem-url-csdl'

const TEP = '.env.test'

const HUONG_DAN = `
Cách làm (khoảng 2 phút):

  1. Neon Console > dự án > Branches > New branch, đặt tên có chữ "test"
  2. Nút Connect > ô Branch chọn nhánh vừa tạo > Copy chuỗi kết nối
  3. Tạo tệp ${TEP} ở thư mục gốc dự án:

       DATABASE_URL="<dán chuỗi THẬT vừa copy>"
       DIRECT_URL="<dán chuỗi THẬT vừa copy>"

  4. npm run db:test
  5. npm run test:tichhop

Chi tiết trong docs/env-test-mau.md.
Test đơn vị không cần bước này — chạy "npm test" là đủ.
`

if (!existsSync(TEP)) {
  throw new Error(`Chưa có tệp ${TEP} nên không chạy được test tích hợp.\n${HUONG_DAN}`)
}

config({ path: TEP, override: true })

const kq = kiemTraUrlCsdlTest(process.env.DATABASE_URL, TEP)
if (!kq.ok) {
  throw new Error(`${kq.loi}\n${HUONG_DAN}`)
}

if (!process.env.DIRECT_URL) process.env.DIRECT_URL = process.env.DATABASE_URL
