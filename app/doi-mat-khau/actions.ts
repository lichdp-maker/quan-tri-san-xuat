'use server'

import { hash, verify } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { nguoiDangDangNhap, taoPhien } from '@/lib/session'
import { kiemTraMatKhau } from '@/lib/mat-khau'

export type KetQua = { ok?: boolean; loi?: string }

export async function doiMatKhau(_truoc: KetQua, formData: FormData): Promise<KetQua> {
  // Gọi thẳng nguoiDangDangNhap chứ không dùng batBuocDangNhap: người còn cờ
  // "phải đổi mật khẩu" bị batBuocDangNhap chặn, mà đây đúng là chỗ họ cần vào.
  const u = await nguoiDangDangNhap()
  if (!u) return { loi: 'Phiên đã hết hạn, đăng nhập lại.' }

  const cu = String(formData.get('cu') ?? '')
  const moi = String(formData.get('moi') ?? '')
  const lai = String(formData.get('lai') ?? '')

  if (moi !== lai) return { loi: 'Hai lần nhập mật khẩu mới không giống nhau.' }
  if (moi === cu) return { loi: 'Mật khẩu mới phải khác mật khẩu cũ.' }

  const kiem = kiemTraMatKhau(moi, u.employeeCode)
  if (!kiem.ok) return { loi: kiem.loi }

  const nd = await prisma.user.findUnique({ where: { id: u.id } })
  if (!nd) return { loi: 'Không tìm thấy tài khoản.' }

  let dung = false
  try {
    dung = await verify(nd.passwordHash, cu)
  } catch {
    dung = false
  }
  if (!dung) return { loi: 'Mật khẩu hiện tại không đúng.' }

  await prisma.user.update({
    where: { id: u.id },
    data: {
      passwordHash: await hash(moi),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
    },
  })

  // Đổi mật khẩu làm hết hiệu lực mọi phiên cũ, kể cả trên máy khác,
  // nên cấp lại phiên mới ngay cho chính người vừa đổi.
  await taoPhien({ id: u.id })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'TU_DOI_MAT_KHAU', entityType: 'User', entityId: u.id },
  })

  return { ok: true }
}
