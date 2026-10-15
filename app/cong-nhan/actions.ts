'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { batBuocQuyen } from '@/lib/session'
import { ngayHomNay, ngayLamViec, mocThoiGian, soPhut, gioHienTai } from '@/lib/date'
import { calcEntry, validateSlotAllocation } from '@/lib/productivity'

const Dong = z.object({
  assignmentId: z.string().min(1),
  qtyOk: z.coerce.number().int().min(0).max(100000),
  qtyDefect: z.coerce.number().int().min(0).max(100000),
  workedMinutes: z.coerce.number().int().min(0).max(1440),
  downtimeMinutes: z.coerce.number().int().min(0).max(1440),
  downtimeReasonId: z.string().optional().nullable(),
  defectTypeId: z.string().optional().nullable(),
  // Hỏng nhiều kiểu trong một mốc: mỗi mã lỗi một số lượng, cộng lại phải bằng qtyDefect
  loi: z
    .array(z.object({ defectTypeId: z.string().min(1), qty: z.coerce.number().int().min(1).max(100000) }))
    .max(10)
    .optional(),
  note: z.string().max(500).optional().nullable(),
})

/** Gom danh sách lỗi của một dòng: ưu tiên danh sách theo mã, không có thì dùng một mã cho cả số hỏng. */
function loiCuaDong(d: z.infer<typeof Dong>): Array<{ defectTypeId: string; qty: number }> {
  if (d.qtyDefect <= 0) return []
  if (d.loi && d.loi.length > 0) return d.loi
  return d.defectTypeId ? [{ defectTypeId: d.defectTypeId, qty: d.qtyDefect }] : []
}

const DuLieu = z.object({
  timeSlotId: z.string().min(1),
  dong: z.array(Dong).min(1),
})

export type KetQuaLuu = { ok?: boolean; loi?: string; canhBao?: string[] }

export async function luuSanLuong(duLieuJson: string): Promise<KetQuaLuu> {
  const u = await batBuocQuyen('NHAP_SAN_LUONG')

  const parsed = DuLieu.safeParse(JSON.parse(duLieuJson))
  if (!parsed.success) return { loi: 'Dữ liệu gửi lên không hợp lệ.' }
  const { timeSlotId, dong } = parsed.data

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  const slot = await prisma.timeSlot.findUnique({ where: { id: timeSlotId } })
  if (!slot || !slot.isActive) return { loi: 'Mốc giờ không tồn tại.' }

  // Không nhập trước cho mốc giờ chưa tới — nếu không thì cảnh báo "chưa nhập"
  // của tổ trưởng mất tác dụng và sản lượng cả ngày khai được từ sáng sớm.
  if (gioHienTai() < slot.startTime) {
    return { loi: `Mốc ${slot.label} chưa bắt đầu (${slot.startTime}). Chưa nhập được.` }
  }

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
    const loi = loiCuaDong(d)
    if (d.qtyDefect > 0 && loi.length === 0) {
      return { loi: 'Có sản phẩm hỏng thì phải chọn mã lỗi.' }
    }
    const tongLoi = loi.reduce((a, x) => a + x.qty, 0)
    if (d.qtyDefect > 0 && tongLoi !== d.qtyDefect) {
      return { loi: `Tổng số theo mã lỗi (${tongLoi}) phải bằng số hỏng (${d.qtyDefect}).` }
    }
  }

  // Mã lỗi gửi lên phải có thật và còn dùng
  const maLoiGui = [...new Set(dong.flatMap((d) => loiCuaDong(d).map((x) => x.defectTypeId)))]
  if (maLoiGui.length > 0) {
    const coThat = await prisma.defectType.count({ where: { id: { in: maLoiGui }, isActive: true } })
    if (coThat !== maLoiGui.length) return { loi: 'Có mã lỗi không còn dùng. Tải lại trang rồi chọn lại.' }
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

      // Bản ghi đã duyệt là số đã chốt: công nhân không tự viết đè được nữa,
      // phải nhờ tổ trưởng từ chối trước. Nếu không thì số đã lên báo cáo
      // vẫn bị sửa sau lưng người duyệt.
      if (cu?.status === 'APPROVED' && u.role === 'WORKER') {
        throw new Error(
          `"${op.name}" đã được duyệt. Muốn sửa thì báo tổ trưởng từ chối bản ghi trước.`,
        )
      }

      // Quản lý sửa bản ghi ĐÃ DUYỆT thì phải trừ lại phần đã cộng vào tiến độ,
      // nếu không tiến độ bị đếm hai lần. Chỉ trừ khi chính lượt này là lượt
      // đổi APPROVED sang PENDING — hai lượt lưu cùng lúc sẽ không trừ hai lần.
      if (cu?.status === 'APPROVED') {
        const doi = await tx.productionEntry.updateMany({
          where: { assignmentId: d.assignmentId, timeSlotId, workDate, status: 'APPROVED' },
          data: { status: 'PENDING', approvedById: null, approvedAt: null },
        })
        if (doi.count === 1) {
          await tx.orderOperation.update({
            where: { id: oo.id },
            data: {
              doneQtyOk: { decrement: cu.qtyOk },
              doneQtyDefect: { decrement: cu.qtyDefect },
            },
          })
        }
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
      const dsLoi = loiCuaDong(d)
      if (dsLoi.length > 0) {
        await tx.defectRecord.createMany({
          data: dsLoi.map((x) => ({ entryId: entry.id, defectTypeId: x.defectTypeId, qty: x.qty })),
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

// ===================== VƯỚNG MẮC & ĐỀ XUẤT CẢI TIẾN =====================

const YKienVao = z.object({
  loai: z.enum(['VUONG_MAC', 'CAI_TIEN']),
  noiDung: z.string().trim().min(5, 'Viết ít nhất vài chữ để người xử lý hiểu.').max(1000, 'Tối đa 1000 ký tự.'),
  assignmentId: z.string().optional().nullable(),
})

const TOI_DA_MOI_NGAY = 20

/** Công nhân gửi vướng mắc hoặc đề xuất cải tiến. Gắn kèm chuyền và nguyên công đang làm. */
export async function guiYKien(vao: {
  loai: string
  noiDung: string
  assignmentId?: string | null
}): Promise<{ ok?: boolean; loi?: string }> {
  const u = await batBuocQuyen('NHAP_SAN_LUONG')

  const kq = YKienVao.safeParse(vao)
  if (!kq.success) return { loi: kq.error.issues[0]?.message ?? 'Nội dung không hợp lệ.' }
  const { loai, noiDung, assignmentId } = kq.data

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  const daGui = await prisma.yKien.count({ where: { userId: u.id, workDate } })
  if (daGui >= TOI_DA_MOI_NGAY) {
    return { loi: `Hôm nay bạn đã gửi ${daGui} ý kiến. Gặp trực tiếp tổ trưởng nếu còn việc gấp.` }
  }

  // Chỉ lấy chuyền / nguyên công từ phân công của CHÍNH người gửi
  let lineId: string | null = null
  let operationId: string | null = null
  if (assignmentId) {
    const a = await prisma.assignment.findFirst({
      where: { id: assignmentId, userId: u.id },
      select: { seat: { select: { lineId: true } }, orderOperation: { select: { operationId: true } } },
    })
    lineId = a?.seat?.lineId ?? null
    operationId = a?.orderOperation.operationId ?? null
  }

  const yk = await prisma.yKien.create({
    data: { userId: u.id, loai, noiDung, workDate, lineId, operationId },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GUI_Y_KIEN', entityType: 'YKien', entityId: yk.id, after: { loai } },
  })

  revalidatePath('/cong-nhan')
  revalidatePath('/y-kien')
  return { ok: true }
}
