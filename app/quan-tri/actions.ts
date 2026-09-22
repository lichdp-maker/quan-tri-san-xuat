'use server'

import { revalidatePath } from 'next/cache'
import { hash } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap, caoHon } from '@/lib/session'
import { soPhut } from '@/lib/date'
import { kiemTraMatKhau, sinhPin } from '@/lib/mat-khau'
import type { Role } from '@prisma/client'

const QUAN_TRI = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

const VAI_TRO_HOP_LE: Role[] = [
  'WORKER',
  'TEAM_LEADER',
  'ENGINEER',
  'WAREHOUSE',
  'PLANNER',
  'SHOP_MANAGER',
  'DEPUTY_DIRECTOR',
  'DIRECTOR',
]

// ===================== NGƯỜI DÙNG =====================

export async function themNguoiDung(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const employeeCode = String(formData.get('employeeCode') ?? '').trim().toUpperCase()
  const fullName = String(formData.get('fullName') ?? '').trim()
  const role = String(formData.get('role') ?? '') as Role
  const teamId = String(formData.get('teamId') ?? '')
  const matKhau = String(formData.get('password') ?? '').trim()

  if (!employeeCode || !fullName || !VAI_TRO_HOP_LE.includes(role)) return
  // Không tạo được người ngang hoặc cao cấp hơn mình
  if (!caoHon(u.role, role)) return
  if (!kiemTraMatKhau(matKhau, employeeCode).ok) return
  if (await prisma.user.findUnique({ where: { employeeCode } })) return

  const nd = await prisma.user.create({
    data: {
      employeeCode,
      fullName,
      role,
      passwordHash: await hash(matKhau),
      teamId: teamId || null,
      mustChangePassword: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'THEM_NGUOI_DUNG',
      entityType: 'User',
      entityId: nd.id,
      after: { employeeCode, fullName, role },
    },
  })

  revalidatePath('/quan-tri')
}

/**
 * Tạo hàng loạt bằng cách dán danh sách, mỗi dòng một người:
 *   MÃ, Họ tên, VAI_TRO, MÃ_TỔ, PIN
 * Vai trò và mã tổ để trống thì mặc định là công nhân, không thuộc tổ nào.
 * PIN để trống, hoặc PIN quá dễ đoán, thì hệ thống sinh PIN ngẫu nhiên.
 * Mọi tài khoản tạo ở đây đều bị bắt đổi mật khẩu ở lần đăng nhập đầu.
 */
export async function themNhieuNguoiDung(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const danhSach = String(formData.get('danhSach') ?? '')
  const dong = danhSach
    .split('\n')
    .map((d) => d.trim())
    .filter(Boolean)
  if (dong.length === 0 || dong.length > 500) return

  const tos = await prisma.team.findMany()
  const banGhi: Array<{
    employeeCode: string
    fullName: string
    role: Role
    teamId: string | null
    passwordHash: string
    mustChangePassword: boolean
  }> = []

  for (const d of dong) {
    const [ma, ten, vaiTro, maTo, pin] = d.split(',').map((x) => (x ?? '').trim())
    if (!ma || !ten) continue

    const role = (VAI_TRO_HOP_LE as string[]).includes((vaiTro ?? '').toUpperCase())
      ? ((vaiTro.toUpperCase() as Role) ?? 'WORKER')
      : 'WORKER'
    const to = maTo ? tos.find((t) => t.code.toUpperCase() === maTo.toUpperCase()) : undefined

    banGhi.push({
      employeeCode: ma.toUpperCase(),
      fullName: ten,
      role,
      teamId: to?.id ?? null,
      // PIN để trống thì sinh ngẫu nhiên. Không dùng một PIN mặc định chung,
      // vì chỉ cần lộ một lần là mở được mọi tài khoản tạo cùng đợt.
      passwordHash: await hash(pin && kiemTraMatKhau(pin, ma).ok ? pin : sinhPin()),
      mustChangePassword: true,
    })
  }

  if (banGhi.length === 0) return

  await prisma.user.createMany({ data: banGhi, skipDuplicates: true })
  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'THEM_NHIEU_NGUOI_DUNG',
      entityType: 'User',
      entityId: 'hang-loat',
      after: { soLuong: banGhi.length },
    },
  })

  revalidatePath('/quan-tri')
}

export async function suaNguoiDung(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const id = String(formData.get('id') ?? '')
  const role = String(formData.get('role') ?? '') as Role
  const teamId = String(formData.get('teamId') ?? '')
  const isActive = formData.get('isActive') === 'on'
  if (!id || !VAI_TRO_HOP_LE.includes(role)) return

  const mucTieu = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!mucTieu) return

  // Không tự khoá chính mình, tránh khoá hết người quản trị
  if (id === u.id && !isActive) return
  // Không tự nâng quyền cho chính mình
  if (id === u.id && role !== mucTieu.role) return
  // Chỉ sửa được người có cấp thấp hơn mình
  if (id !== u.id && !caoHon(u.role, mucTieu.role)) return
  // Không cấp cho ai vai trò ngang hoặc cao hơn mình
  if (role !== mucTieu.role && !caoHon(u.role, role)) return

  await prisma.user.update({
    where: { id },
    data: { role, teamId: teamId || null, isActive },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_NGUOI_DUNG',
      entityType: 'User',
      entityId: id,
      after: { role, teamId: teamId || null, isActive },
    },
  })

  revalidatePath('/quan-tri')
}

export async function datLaiMatKhau(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const id = String(formData.get('id') ?? '')
  const matKhau = String(formData.get('password') ?? '').trim()
  if (!id) return

  const mucTieu = await prisma.user.findUnique({
    where: { id },
    select: { role: true, employeeCode: true },
  })
  if (!mucTieu) return
  // Không đặt lại mật khẩu của người ngang hoặc cao cấp hơn mình —
  // nếu không, quản lý xưởng chiếm được tài khoản giám đốc.
  if (id !== u.id && !caoHon(u.role, mucTieu.role)) return

  const kiem = kiemTraMatKhau(matKhau, mucTieu.employeeCode)
  if (!kiem.ok) return

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hash(matKhau),
      // Người được cấp lại phải tự đổi ngay, và mọi phiên cũ của họ hết hiệu lực
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
    },
  })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'DAT_LAI_MAT_KHAU', entityType: 'User', entityId: id },
  })

  revalidatePath('/quan-tri')
}

// ===================== TỔ =====================

export async function themTo(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  if (!code || !name) return
  if (await prisma.team.findUnique({ where: { code } })) return

  const t = await prisma.team.create({ data: { code, name } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_TO', entityType: 'Team', entityId: t.id, after: { code, name } },
  })

  revalidatePath('/quan-tri')
}

export async function ganToTruong(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const id = String(formData.get('id') ?? '')
  const leaderId = String(formData.get('leaderId') ?? '')
  if (!id) return

  await prisma.team.update({ where: { id }, data: { leaderId: leaderId || null } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'GAN_TO_TRUONG', entityType: 'Team', entityId: id, after: { leaderId } },
  })

  revalidatePath('/quan-tri')
}

// ===================== CA & MỐC GIỜ =====================

export async function suaCa(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  if (!id || !name || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return

  await prisma.shift.update({ where: { id }, data: { name, startTime, endTime } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'SUA_CA', entityType: 'Shift', entityId: id, after: { startTime, endTime } },
  })

  revalidatePath('/quan-tri')
}

/**
 * Sửa một mốc giờ. Dữ liệu cũ KHÔNG bị ảnh hưởng: mỗi bản ghi đã lưu lại
 * mốc thật lúc nhập (slotStartAt / slotEndAt), nên báo cáo quá khứ giữ nguyên.
 */
export async function suaMocGio(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const breakMinutes = Number(String(formData.get('breakMinutes') ?? '0'))
  const isActive = formData.get('isActive') === 'on'

  if (!id || !label) return
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) return
  if (soPhut(startTime, endTime, breakMinutes) <= 0) return // nghỉ dài hơn cả khoảng

  await prisma.timeSlot.update({
    where: { id },
    data: { label, startTime, endTime, breakMinutes, isActive },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_MOC_GIO',
      entityType: 'TimeSlot',
      entityId: id,
      after: { label, startTime, endTime, breakMinutes, isActive },
    },
  })

  revalidatePath('/quan-tri')
}

export async function themMocGio(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...QUAN_TRI)

  const shiftId = String(formData.get('shiftId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const breakMinutes = Number(String(formData.get('breakMinutes') ?? '0'))
  if (!shiftId || !label) return
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return

  const cuoi = await prisma.timeSlot.findFirst({ where: { shiftId }, orderBy: { seq: 'desc' } })

  const s = await prisma.timeSlot.create({
    data: {
      shiftId,
      seq: (cuoi?.seq ?? 0) + 1,
      label,
      startTime,
      endTime,
      breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : 0,
    },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_MOC_GIO', entityType: 'TimeSlot', entityId: s.id, after: { label } },
  })

  revalidatePath('/quan-tri')
}
