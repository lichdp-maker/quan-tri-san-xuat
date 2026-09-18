'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { ngayHomNay, ngayLamViec } from '@/lib/date'

const QUAN_LY = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

/** Duyệt bản ghi: chuyển sang APPROVED và cộng vào tiến độ của nguyên công. */
export async function duyetBanGhi(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)
  const ids = formData.getAll('id').map(String).filter(Boolean)
  if (ids.length === 0) return

  const entries = await prisma.productionEntry.findMany({
    where: {
      id: { in: ids },
      status: 'PENDING',
      ...(u.role === 'TEAM_LEADER' ? { assignment: { teamId: u.teamId ?? '' } } : {}),
    },
    select: {
      id: true,
      qtyOk: true,
      qtyDefect: true,
      assignment: { select: { orderOperationId: true } },
    },
  })

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      await tx.productionEntry.update({
        where: { id: e.id },
        data: { status: 'APPROVED', approvedById: u.id, approvedAt: new Date() },
      })
      await tx.orderOperation.update({
        where: { id: e.assignment.orderOperationId },
        data: {
          doneQtyOk: { increment: e.qtyOk },
          doneQtyDefect: { increment: e.qtyDefect },
        },
      })
      await tx.auditLog.create({
        data: {
          userId: u.id,
          action: 'DUYET_BAN_GHI',
          entityType: 'ProductionEntry',
          entityId: e.id,
          after: { qtyOk: e.qtyOk, qtyDefect: e.qtyDefect },
        },
      })
    }
  })

  revalidatePath('/to-truong')
}

/** Từ chối bản ghi để công nhân nhập lại. Không cộng vào tiến độ. */
export async function tuChoiBanGhi(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)
  const id = String(formData.get('id') ?? '')
  if (!id) return

  await prisma.productionEntry.updateMany({
    where: {
      id,
      status: 'PENDING',
      ...(u.role === 'TEAM_LEADER' ? { assignment: { teamId: u.teamId ?? '' } } : {}),
    },
    data: { status: 'REJECTED', approvedById: u.id, approvedAt: new Date() },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'TU_CHOI_BAN_GHI', entityType: 'ProductionEntry', entityId: id },
  })

  revalidatePath('/to-truong')
}

/** Gán một công nhân vào một nguyên công của lệnh, cho ngày hôm nay. */
export async function taoPhanCong(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const userId = String(formData.get('userId') ?? '')
  const orderOperationId = String(formData.get('orderOperationId') ?? '')
  const shiftId = String(formData.get('shiftId') ?? '')
  const chiTieu = String(formData.get('targetQty') ?? '').trim()
  if (!userId || !orderOperationId || !shiftId) return

  const cn = await prisma.user.findUnique({ where: { id: userId } })
  if (!cn || !cn.isActive || !cn.teamId) return
  if (u.role === 'TEAM_LEADER' && cn.teamId !== u.teamId) return

  const workDate = ngayLamViec(ngayHomNay())

  await prisma.assignment.upsert({
    where: {
      orderOperationId_userId_workDate_shiftId: { orderOperationId, userId, workDate, shiftId },
    },
    update: { targetQty: chiTieu ? Number(chiTieu) : null },
    create: {
      orderOperationId,
      userId,
      teamId: cn.teamId,
      shiftId,
      workDate,
      targetQty: chiTieu ? Number(chiTieu) : null,
      assignedById: u.id,
    },
  })

  revalidatePath('/to-truong')
  revalidatePath('/to-truong/phan-cong')
}

/** Gỡ phân công khi chưa có bản ghi nào. */
export async function xoaPhanCong(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const a = await prisma.assignment.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  })
  if (!a || a._count.entries > 0) return
  if (u.role === 'TEAM_LEADER' && a.teamId !== u.teamId) return

  await prisma.assignment.delete({ where: { id } })
  revalidatePath('/to-truong/phan-cong')
}
