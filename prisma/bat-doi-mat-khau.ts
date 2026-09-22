/**
 * Bắt mọi tài khoản đang dùng mật khẩu cấp sẵn phải đổi ở lần đăng nhập tới.
 *
 * Không đụng vào mật khẩu hiện tại: người dùng vẫn đăng nhập bằng mật khẩu cũ
 * một lần cuối, rồi hệ thống chặn lại ở màn hình đổi mật khẩu cho tới khi đổi xong.
 * Nhờ vậy không phải in ra hay gửi mật khẩu mới cho 46 người.
 *
 * Chạy:  npm run db:batdoimk           (mọi người chưa từng tự đổi)
 *        npm run db:batdoimk -- --tatca (kể cả người đã tự đổi rồi)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tatCa = process.argv.includes('--tatca')

  const { count } = await prisma.user.updateMany({
    where: {
      isActive: true,
      mustChangePassword: false,
      // Người đã tự đổi mật khẩu rồi thì để yên, trừ khi yêu cầu làm tất
      ...(tatCa ? {} : { passwordChangedAt: null }),
    },
    data: { mustChangePassword: true },
  })

  const conLai = await prisma.user.count({ where: { isActive: true, mustChangePassword: true } })

  console.log(`Đã đặt cờ bắt đổi mật khẩu cho ${count} tài khoản.`)
  console.log(`Tổng cộng ${conLai} người sẽ phải đổi mật khẩu ở lần đăng nhập tới.`)
  console.log('Họ vẫn đăng nhập bằng mật khẩu cũ, nhưng không vào được đâu cho tới khi đổi.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
