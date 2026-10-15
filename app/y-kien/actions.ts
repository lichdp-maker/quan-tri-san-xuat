'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { batBuocQuyen } from '@/lib/session'
import { ngoaiPhamViTo } from '@/lib/quyen'

const CapNhatVao = z.object({
  id: z.string().min(1),
  trangThai: z.enum(['MOI', 'DANG_XU_LY', 'DA_XU_LY']),
  phanHoi: z
    .string()
    .trim()
    .max(1000, 'Phản hồi tối đa 1000 ký tự.')
    .optional()
    .nullable(),
})

/**
 * Tổ trưởng / quản lý cập nhật trạng thái và trả lời một ý kiến.
 * Tổ trưởng chỉ xử lý ý kiến của người trong tổ mình hoặc trên chuyền của tổ mình.
 */
export async function capNhatYKien(vao: {
  id: string
  trangThai: string
  phanHoi?: string | null
}): Promise<{ ok?: boolean; loi?: string }> {
  const u = await batBuocQuyen('XU_LY_Y_KIEN')

  const kq = CapNhatVao.safeParse(vao)
  if (!kq.success) return { loi: kq.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' }
  const { id, trangThai } = kq.data
  const phanHoi = kq.data.phanHoi ? kq.data.phanHoi : null

  const yk = await prisma.yKien.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      trangThai: true,
      user: { select: { teamId: true } },
      line: { select: { teamId: true } },
    },
  })
  if (!yk) return { loi: 'Không tìm thấy ý kiến này.' }

  const ngoaiToNguoi = ngoaiPhamViTo(u.role, u.teamId, yk.user.teamId)
  const ngoaiToChuyen = ngoaiPhamViTo(u.role, u.teamId, yk.line?.teamId ?? null)
  if (ngoaiToNguoi && ngoaiToChuyen) return { loi: 'Ý kiến này không thuộc tổ của bạn.' }

  if (trangThai === 'DA_XU_LY' && !phanHoi) {
    return { loi: 'Ghi vài chữ phản hồi để công nhân biết đã xử lý thế nào.' }
  }

  await prisma.yKien.update({
    where: { id },
    data: {
      trangThai,
      phanHoi,
      xuLyBoiId: u.id,
      xuLyLuc: new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'XU_LY_Y_KIEN',
      entityType: 'YKien',
      entityId: id,
      before: { trangThai: yk.trangThai },
      after: { trangThai },
    },
  })

  revalidatePath('/y-kien')
  revalidatePath('/cong-nhan')
  return { ok: true }
}
