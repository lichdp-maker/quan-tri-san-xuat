'use server'

import { revalidatePath } from 'next/cache'
import { hash } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'
import { soPhut } from '@/lib/date'
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

  if (!employeeCode || !fullName || !VAI_TRO_HOP_LE.includes(role) || matKhau.length < 4) return
  if (await prisma.user.findUnique({ where: { employeeCode } })) return

  const nd = await prisma.user.create({
    data: {
      employeeCode,
      fullName,
      role,
      passwordHash: await hash(matKhau),
      teamId: teamId || null,
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
 * PIN để trống thì mặc định 123456 — bắt buộc đổi ở lần dùng đầu.
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
  const banGhi: Array<{ employeeCode: string; fullName: string; role: Role; teamId: string | null; passwordHash: string }> = []

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
      passwordHash: await hash(pin && pin.length >= 4 ? pin : '123456'),
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

  // Không tự khoá chính mình, tránh khoá hết người quản trị
  if (id === u.id && !isActive) return

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
  if (!id || matKhau.length < 4) return

  await prisma.user.update({ where: { id }, data: { passwordHash: await hash(matKhau) } })
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
