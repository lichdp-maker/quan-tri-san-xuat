'use server'

import { hash, verify } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'

export type KetQua = { ok?: boolean; loi?: string }

export async function doiMatKhau(_truoc: KetQua, formData: FormData): Promise<KetQua> {
  const u = await batBuocDangNhap()

  const cu = String(formData.get('cu') ?? '')
  const moi = String(formData.get('moi') ?? '')
  const lai = String(formData.get('lai') ?? '')

  if (moi.length < 4) return { loi: 'Mật khẩu mới phải từ 4 ký tự trở lên.' }
  if (moi !== lai) return { loi: 'Hai lần nhập mật khẩu mới không giống nhau.' }
  if (moi === cu) return { loi: 'Mật khẩu mới phải khác mật khẩu cũ.' }

  const nd = await prisma.user.findUnique({ where: { id: u.id } })
  if (!nd) return { loi: 'Không tìm thấy tài khoản.' }

  let dung = false
  try {
    dung = await verify(nd.passwordHash, cu)
  } catch {
    dung = false
  }
  if (!dung) return { loi: 'Mật khẩu hiện tại không đúng.' }

  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hash(moi) } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'TU_DOI_MAT_KHAU', entityType: 'User', entityId: u.id },
  })

  return { ok: true }
}
