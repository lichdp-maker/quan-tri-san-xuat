/**
 * Dựng dữ liệu tối thiểu cho từng test tích hợp, và dọn sạch giữa các test.
 *
 * Mỗi test tự dựng đúng thứ mình cần rồi khẳng định trên đó, không dùng chung
 * trạng thái — test này hỏng không kéo test kia hỏng theo.
 */
import { PrismaClient, type Role } from '@prisma/client'

export const db = new PrismaClient()

/** Xoá theo đúng thứ tự khoá ngoại. */
export async function donSach() {
  await db.defectRecord.deleteMany()
  await db.productionEntry.deleteMany()
  await db.assignment.deleteMany()
  await db.auditLog.deleteMany()
  await db.seat.deleteMany()
  await db.line.deleteMany()
  await db.orderOperation.deleteMany()
  await db.productionOrder.deleteMany()
  await db.operation.deleteMany()
  await db.productSection.deleteMany()
  await db.product.deleteMany()
  await db.timeSlot.deleteMany()
  await db.shift.deleteMany()
  await db.defectType.deleteMany()
  await db.defectCause.deleteMany()
  await db.downtimeReason.deleteMany()
  // Gỡ tổ trưởng trước rồi mới xoá người, vì Team.leaderId trỏ sang User
  await db.team.updateMany({ data: { leaderId: null } })
  await db.user.updateMany({ data: { teamId: null } })
  await db.user.deleteMany()
  await db.team.deleteMany()
}

let dem = 0
const maMoi = (tienTo: string) => `${tienTo}${++dem}-${Date.now().toString().slice(-5)}`

export async function taoTo(ten = 'Tổ thử') {
  return db.team.create({ data: { code: maMoi('TO'), name: ten } })
}

export async function taoNguoi(opts: {
  role: Role
  teamId?: string | null
  ten?: string
  dangLamViec?: boolean
}) {
  return db.user.create({
    data: {
      employeeCode: maMoi('NV'),
      fullName: opts.ten ?? 'Người thử',
      role: opts.role,
      teamId: opts.teamId ?? null,
      // Băm giả, test không đăng nhập thật nên không cần argon2 cho chậm
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$khong-dung',
      isActive: opts.dangLamViec ?? true,
    },
  })
}

export async function taoCa(mocGio = [{ label: '9h30', startTime: '08:00', endTime: '09:30' }]) {
  return db.shift.create({
    data: {
      code: maMoi('CA'),
      name: 'Ca thử',
      startTime: '08:00',
      endTime: '21:00',
      timeSlots: {
        create: mocGio.map((m, i) => ({
          seq: i + 1,
          label: m.label,
          startTime: m.startTime,
          endTime: m.endTime,
        })),
      },
    },
    include: { timeSlots: { orderBy: { seq: 'asc' } } },
  })
}

/** Một sản phẩm một bộ phận một nguyên công — đủ để thử luồng sản lượng. */
export async function taoLenh(opts: {
  nguoiTaoId: string
  soLuong?: number
  dinhMucGiay?: number
  trangThai?: 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED'
}) {
  const soLuong = opts.soLuong ?? 1000

  const sp = await db.product.create({
    data: {
      code: maMoi('SP'),
      name: 'Sản phẩm thử',
      sections: { create: { code: 'BP', name: 'Bộ phận thử', seq: 10 } },
    },
    include: { sections: true },
  })

  const nc = await db.operation.create({
    data: {
      sectionId: sp.sections[0].id,
      seq: 1,
      code: maMoi('NC'),
      name: 'Nguyên công thử',
      standardSeconds: opts.dinhMucGiay ?? 60,
    },
  })

  const lenh = await db.productionOrder.create({
    data: {
      code: maMoi('LSX'),
      productId: sp.id,
      quantity: soLuong,
      status: opts.trangThai ?? 'IN_PROGRESS',
      createdById: opts.nguoiTaoId,
    },
  })

  const oo = await db.orderOperation.create({
    data: {
      orderId: lenh.id,
      operationId: nc.id,
      sectionCode: 'BP',
      seq: 1,
      targetQty: soLuong,
      standardSeconds: nc.standardSeconds,
    },
  })

  return { sp, nc, lenh, oo }
}

export async function taoPhanCongThu(opts: {
  orderOperationId: string
  userId: string
  teamId: string
  shiftId: string
  workDate: Date
  nguoiGanId: string
  seatId?: string
}) {
  return db.assignment.create({
    data: {
      orderOperationId: opts.orderOperationId,
      userId: opts.userId,
      teamId: opts.teamId,
      shiftId: opts.shiftId,
      workDate: opts.workDate,
      seatId: opts.seatId ?? null,
      assignedById: opts.nguoiGanId,
    },
  })
}

export async function taoBanGhi(opts: {
  assignmentId: string
  timeSlotId: string
  workDate: Date
  qtyOk: number
  createdById: string
  trangThai?: 'PENDING' | 'APPROVED' | 'REJECTED'
}) {
  return db.productionEntry.create({
    data: {
      assignmentId: opts.assignmentId,
      timeSlotId: opts.timeSlotId,
      workDate: opts.workDate,
      slotStartAt: new Date(),
      slotEndAt: new Date(),
      qtyOk: opts.qtyOk,
      qtyDefect: 0,
      workedMinutes: 90,
      status: opts.trangThai ?? 'PENDING',
      createdById: opts.createdById,
    },
  })
}

/** Dựng FormData như trình duyệt gửi lên cho server action. */
export function form(truong: Record<string, string | string[]>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(truong)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x))
    else f.set(k, v)
  }
  return f
}
