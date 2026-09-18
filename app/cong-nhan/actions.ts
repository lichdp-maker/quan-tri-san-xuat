'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { ngayHomNay, ngayLamViec, mocThoiGian, soPhut } from '@/lib/date'
import { calcEntry, validateSlotAllocation } from '@/lib/productivity'

const Dong = z.object({
  assignmentId: z.string().min(1),
  qtyOk: z.coerce.number().int().min(0).max(100000),
  qtyDefect: z.coerce.number().int().min(0).max(100000),
  workedMinutes: z.coerce.number().int().min(0).max(1440),
  downtimeMinutes: z.coerce.number().int().min(0).max(1440),
  downtimeReasonId: z.string().optional().nullable(),
  defectTypeId: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

const DuLieu = z.object({
  timeSlotId: z.string().min(1),
  dong: z.array(Dong).min(1),
})

export type KetQuaLuu = { ok?: boolean; loi?: string; canhBao?: string[] }

export async function luuSanLuong(duLieuJson: string): Promise<KetQuaLuu> {
  const u = await batBuocDangNhap('WORKER', 'TEAM_LEADER')

  const parsed = DuLieu.safeParse(JSON.parse(duLieuJson))
  if (!parsed.success) return { loi: 'Dữ liệu gửi lên không hợp lệ.' }
  const { timeSlotId, dong } = parsed.data

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  const slot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } })
  if (!slot || !slot.isActive) return { loi: 'Mốc giờ không tồn tại.' }

  const doDaiMoc = soPhut(slot.startTime, slot.endTime, slot.breakMinutes)

  // Chỉ nhận các phân công của chính người đang đăng nhập, trong đúng ngày và đúng ca
  const assignments = await prisma.assignment.findMany({
    where: {
      id: { in: dong.map((d) => d.assignmentId) },
      userId: u.id,
      workDate,
      shiftId: slot.shiftId,
    },
    include: { orderOperation: { include: { operation: true } } },
  })
  if (assignments.length !== dong.length) {
    return { loi: 'Có dòng không thuộc phân công của bạn trong mốc giờ này.' }
  }

  // Tổng phút khai trong mốc không được vượt độ dài mốc (tính cả các dòng đã lưu trước đó)
  const daLuu = await prisma.productionEntry.findMany({
    where: {
      timeSlotId,
      workDate,
      assignment: { userId: u.id },
      assignmentId: { notIn: dong.map((d) => d.assignmentId) },
    },
    select: { workedMinutes: true },
  })
  const kiemTra = validateSlotAllocation([...daLuu, ...dong], doDaiMoc)
  if (!kiemTra.ok) {
    return {
      loi: `Tổng thời gian khai là ${kiemTra.totalMinutes} phút, vượt độ dài mốc giờ (${doDaiMoc} phút) ${kiemTra.overBy} phút.`,
    }
  }

  for (const d of dong) {
    if (d.downtimeMinutes > d.workedMinutes) {
      return { loi: 'Thời gian dừng không được lớn hơn thời gian làm.' }
    }
    if (d.qtyDefect > 0 && !d.defectTypeId) {
      return { loi: 'Có sản phẩm hỏng thì phải chọn loại lỗi.' }
    }
  }

  const canhBao: string[] = []

  try {
    await prisma.$transaction(async (tx) => {
    for (const d of dong) {
      const a = assignments.find((x) => x.id === d.assignmentId)!
      const oo = a.orderOperation
      const op = oo.operation

      // Không cho vượt số lượng của lệnh
      const tong = await tx.productionEntry.aggregate({
        where: { assignment: { orderOperationId: oo.id } },
        _sum: { qtyOk: true },
      })
      const daCo = tong._sum.qtyOk ?? 0
      const cu = await tx.productionEntry.findUnique({
        where: {
          assignmentId_timeSlotId_workDate: {
            assignmentId: d.assignmentId,
            timeSlotId,
            workDate,
          },
        },
        select: { qtyOk: true, qtyDefect: true, status: true },
      })

      // Sửa một bản ghi ĐÃ DUYỆT thì phải trừ lại phần đã cộng vào tiến độ lệnh,
      // nếu không tiến độ sẽ bị đếm hai lần.
      if (cu?.status === 'APPROVED') {
        await tx.orderOperation.update({
          where: { id: oo.id },
          data: {
            doneQtyOk: { decrement: cu.qtyOk },
            doneQtyDefect: { decrement: cu.qtyDefect },
          },
        })
      }
      const sauKhiLuu = daCo - (cu?.qtyOk ?? 0) + d.qtyOk
      if (sauKhiLuu > oo.targetQty) {
        throw new Error(
          `Nguyên công "${op.name}" đã đủ ${oo.targetQty} sản phẩm của lệnh, không nhập thêm được.`,
        )
      }

      const kq = calcEntry({
        qtyOk: d.qtyOk,
        standardSeconds: oo.standardSeconds,
        workedMinutes: d.workedMinutes,
        downtimeMinutes: d.downtimeMinutes,
        targetPercent: op.targetPercent,
      })
      if (kq.warning === 'IMPLAUSIBLE') {
        canhBao.push(
          `"${op.name}": năng suất ${kq.performance}% — kiểm tra lại số lượng hoặc thời gian.`,
        )
      }

      const chung = {
        qtyOk: d.qtyOk,
        qtyDefect: d.qtyDefect,
        workedMinutes: d.workedMinutes,
        downtimeMinutes: d.downtimeMinutes,
        downtimeReasonId: d.downtimeReasonId || null,
        note: d.note || null,
        earnedSeconds: kq.earnedSeconds,
        netMinutes: kq.netMinutes,
        performance: kq.performance,
        isAchieved: kq.isAchieved,
      }

      const entry = await tx.productionEntry.upsert({
        where: {
          assignmentId_timeSlotId_workDate: {
            assignmentId: d.assignmentId,
            timeSlotId,
            workDate,
          },
        },
        update: { ...chung, status: 'PENDING', approvedById: null, approvedAt: null },
        create: {
          ...chung,
          assignmentId: d.assignmentId,
          timeSlotId,
          workDate,
          slotStartAt: mocThoiGian(ymd, slot.startTime),
          slotEndAt: mocThoiGian(ymd, slot.endTime),
          status: 'PENDING',
          createdById: u.id,
        },
      })

      await tx.defectRecord.deleteMany({ where: { entryId: entry.id } })
      if (d.qtyDefect > 0 && d.defectTypeId) {
        await tx.defectRecord.create({
          data: { entryId: entry.id, defectTypeId: d.defectTypeId, qty: d.qtyDefect },
        })
      }

      await tx.auditLog.create({
        data: {
          userId: u.id,
          action: cu ? 'SUA_BAN_GHI' : 'TAO_BAN_GHI',
          entityType: 'ProductionEntry',
          entityId: entry.id,
          before: cu ? { qtyOk: cu.qtyOk } : undefined,
          after: { qtyOk: d.qtyOk, qtyDefect: d.qtyDefect },
        },
      })
      }
    })
  } catch (e) {
    return { loi: e instanceof Error ? e.message : 'Không lưu được, thử lại.' }
  }

  revalidatePath('/cong-nhan')
  return { ok: true, canhBao: canhBao.length ? canhBao : undefined }
}
