'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { ngayHomNay, ngayLamViec } from '@/lib/date'

const QUAN_LY = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

export type KetQua = { ok?: boolean; loi?: string }

/** Tạo dây chuyền mới kèm đủ ghế hai mặt. */
export async function taoDayChuyen(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap('SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const soGhe = Number(String(formData.get('soGhe') ?? '20'))
  const teamId = String(formData.get('teamId') ?? '')
  if (!code || !name || !Number.isFinite(soGhe) || soGhe < 2 || soGhe > 60) return
  if (await prisma.line.findUnique({ where: { code } })) return

  const moiMat = Math.ceil(soGhe / 2)

  await prisma.$transaction(async (tx) => {
    const line = await tx.line.create({
      data: { code, name, soGhe, teamId: teamId || null },
    })
    const ghe: Array<{ lineId: string; seq: number; side: 'A' | 'B' }> = []
    for (let i = 1; i <= moiMat; i++) ghe.push({ lineId: line.id, seq: i, side: 'A' })
    for (let i = 1; i <= soGhe - moiMat; i++) ghe.push({ lineId: line.id, seq: i, side: 'B' })
    await tx.seat.createMany({ data: ghe })

    await tx.auditLog.create({
      data: { userId: u.id, action: 'TAO_DAY_CHUYEN', entityType: 'Line', entityId: line.id, after: { code, soGhe } },
    })
  })

  revalidatePath('/day-chuyen')
}

/** Chọn lệnh sản xuất đang chạy trên dây chuyền và ca làm việc. */
export async function datLenhChoDayChuyen(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const lineId = String(formData.get('lineId') ?? '')
  const orderId = String(formData.get('orderId') ?? '')
  const shiftId = String(formData.get('shiftId') ?? '')
  if (!lineId) return

  await prisma.line.update({
    where: { id: lineId },
    data: { currentOrderId: orderId || null, shiftId: shiftId || null },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'DAT_LENH_DAY_CHUYEN', entityType: 'Line', entityId: lineId, after: { orderId } },
  })

  revalidatePath('/day-chuyen')
}

/** Gán nguyên công cho một vị trí ngồi. */
export async function ganNguyenCongChoGhe(seatId: string, operationId: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)
  if (!seatId) return { loi: 'Thiếu vị trí.' }

  await prisma.seat.update({
    where: { id: seatId },
    data: { operationId: operationId || null },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GAN_NGUYEN_CONG_GHE', entityType: 'Seat', entityId: seatId, after: { operationId } },
  })

  revalidatePath('/day-chuyen')
  return { ok: true }
}

/**
 * Kéo một công nhân vào vị trí ngồi.
 * Tạo luôn phân công của hôm nay cho nguyên công gắn với vị trí đó.
 */
export async function ganNguoiVaoGhe(seatId: string, userId: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)

  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
    include: { line: true, operation: true },
  })
  if (!seat) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (!seat.operationId) return { loi: `Vị trí ${seat.side}${seat.seq} chưa gán nguyên công.` }
  if (!seat.line.currentOrderId) return { loi: 'Dây chuyền chưa chọn lệnh sản xuất đang chạy.' }
  if (!seat.line.shiftId) return { loi: 'Dây chuyền chưa chọn ca làm việc.' }

  const cn = await prisma.user.findUnique({ where: { id: userId } })
  if (!cn || !cn.isActive || !cn.teamId) return { loi: 'Công nhân không hợp lệ hoặc chưa thuộc tổ nào.' }
  if (u.role === 'TEAM_LEADER' && cn.teamId !== u.teamId) return { loi: 'Người này không thuộc tổ của bạn.' }

  const oo = await prisma.orderOperation.findUnique({
    where: { orderId_operationId: { orderId: seat.line.currentOrderId, operationId: seat.operationId } },
  })
  if (!oo) return { loi: 'Nguyên công của vị trí này không thuộc lệnh đang chạy.' }

  const workDate = ngayLamViec(ngayHomNay())

  // Một vị trí chỉ một người trong ngày: gỡ người cũ ra trước
  await prisma.assignment.deleteMany({
    where: { seatId, workDate, entries: { none: {} } },
  })

  await prisma.assignment.upsert({
    where: {
      orderOperationId_userId_workDate_shiftId: {
        orderOperationId: oo.id,
        userId,
        workDate,
        shiftId: seat.line.shiftId,
      },
    },
    update: { seatId, teamId: cn.teamId },
    create: {
      orderOperationId: oo.id,
      userId,
      teamId: cn.teamId,
      shiftId: seat.line.shiftId,
      workDate,
      seatId,
      assignedById: u.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'GAN_NGUOI_VAO_GHE',
      entityType: 'Seat',
      entityId: seatId,
      after: { userId, operationId: seat.operationId },
    },
  })

  revalidatePath('/day-chuyen')
  return { ok: true }
}

/** Gỡ người khỏi vị trí. Chỉ gỡ được khi người đó chưa nhập số liệu nào. */
export async function goNguoiKhoiGhe(seatId: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)
  const workDate = ngayLamViec(ngayHomNay())

  const pc = await prisma.assignment.findFirst({
    where: { seatId, workDate },
    include: { _count: { select: { entries: true } } },
  })
  if (!pc) return { ok: true }
  if (pc._count.entries > 0) return { loi: 'Người này đã nhập số liệu, không gỡ được. Hãy sửa bản ghi thay vì gỡ.' }

  await prisma.assignment.delete({ where: { id: pc.id } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GO_NGUOI_KHOI_GHE', entityType: 'Seat', entityId: seatId },
  })

  revalidatePath('/day-chuyen')
  return { ok: true }
}
