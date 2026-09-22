'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { ngoaiPhamViTo } from '@/lib/quyen'
import { ngayHomNay, ngayLamViec } from '@/lib/date'

const QUAN_LY = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

export type KetQua = { ok?: boolean; loi?: string; chu?: string }

// Tổ trưởng chỉ thao tác trên dây chuyền của tổ mình. Trang /day-chuyen liệt kê
// mọi chuyền cho tổ trưởng xem, nên nếu không kiểm ở đây thì họ gửi thẳng id ghế
// của chuyền tổ khác và sửa được phân công của tổ đó.

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

/**
 * Sửa một dây chuyền đã có: đổi tên, đổi tổ, tăng giảm số ghế, hoặc cho ngừng dùng.
 * Tăng ghế thì thêm vào cho đủ hai mặt; giảm ghế chỉ xóa được những ghế chưa ai ngồi.
 */
export async function doiDayChuyen(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap('SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR')

  const lineId = String(formData.get('lineId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const soGhe = Number(String(formData.get('soGhe') ?? '0'))
  const teamId = String(formData.get('teamId') ?? '')
  const conDung = String(formData.get('conDung') ?? '') === 'co'
  if (!lineId || !name || !Number.isFinite(soGhe) || soGhe < 2 || soGhe > 60) return

  await prisma.$transaction(async (tx) => {
    await tx.line.update({
      where: { id: lineId },
      data: { name, soGhe, teamId: teamId || null, isActive: conDung },
    })

    const ghe = await tx.seat.findMany({ where: { lineId }, select: { id: true, side: true, seq: true } })
    const mucA = Math.ceil(soGhe / 2)

    for (const [side, muc] of [
      ['A', mucA],
      ['B', soGhe - mucA],
    ] as const) {
      const hienCo = ghe.filter((g) => g.side === side)
      const coSeq = new Set(hienCo.map((g) => g.seq))

      const them: Array<{ lineId: string; side: 'A' | 'B'; seq: number }> = []
      for (let i = 1; i <= muc; i++) if (!coSeq.has(i)) them.push({ lineId, side, seq: i })
      if (them.length) await tx.seat.createMany({ data: them })

      const du = hienCo.filter((g) => g.seq > muc).map((g) => g.id)
      if (du.length) {
        await tx.seat.deleteMany({ where: { id: { in: du }, assignments: { none: {} } } })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: u.id,
        action: 'SUA_DAY_CHUYEN',
        entityType: 'Line',
        entityId: lineId,
        after: { name, soGhe, isActive: conDung },
      },
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

  const line = await prisma.line.findUnique({ where: { id: lineId }, select: { teamId: true } })
  if (!line || ngoaiPhamViTo(u.role, u.teamId, line.teamId)) return

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

  const ghe = await prisma.seat.findUnique({
    where: { id: seatId },
    select: { line: { select: { teamId: true } } },
  })
  if (!ghe) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (ngoaiPhamViTo(u.role, u.teamId, ghe.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }

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
  if (ngoaiPhamViTo(u.role, u.teamId, seat.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }
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

  // Nhắc nếu người này còn đang ngồi ở chuyền khác trong cùng ngày
  const noiKhac = await prisma.assignment.findMany({
    where: { userId, workDate, seatId: { not: null }, seat: { lineId: { not: seat.lineId } } },
    select: { seat: { select: { side: true, seq: true, line: { select: { name: true } } } } },
  })

  revalidatePath('/day-chuyen')
  return {
    ok: true,
    chu:
      noiKhac.length > 0
        ? `Lưu ý: ${cn.fullName} còn đang ngồi ở ${noiKhac
            .map((n) => `${n.seat!.line.name} ${n.seat!.side}${n.seat!.seq}`)
            .join(', ')}.`
        : undefined,
  }
}

/** Gỡ người khỏi vị trí. Chỉ gỡ được khi người đó chưa nhập số liệu nào. */
export async function goNguoiKhoiGhe(seatId: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...QUAN_LY)
  const workDate = ngayLamViec(ngayHomNay())

  const ghe = await prisma.seat.findUnique({
    where: { id: seatId },
    select: { line: { select: { teamId: true } } },
  })
  if (!ghe) return { loi: 'Không tìm thấy vị trí ngồi.' }
  if (ngoaiPhamViTo(u.role, u.teamId, ghe.line.teamId)) {
    return { loi: 'Dây chuyền này không thuộc tổ của bạn.' }
  }

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
