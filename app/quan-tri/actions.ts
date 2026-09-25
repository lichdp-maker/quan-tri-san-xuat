'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hash } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { batBuocQuyen } from '@/lib/session'
import { caoHon, duocSuaNguoiDung, duocDatLaiMatKhau } from '@/lib/quyen'
import { soPhut } from '@/lib/date'
import { kiemTraMatKhau, sinhPin } from '@/lib/mat-khau'
import { tachThemBot } from '@/lib/chuc-nang'
import { laTinhTrang } from '@/lib/tinh-trang'
import type { Role } from '@prisma/client'

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
  const u = await batBuocQuyen('QT_NGUOI_DUNG')

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
  const u = await batBuocQuyen('QT_NGUOI_DUNG')

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
  const u = await batBuocQuyen('QT_NGUOI_DUNG')

  const id = String(formData.get('id') ?? '')
  const role = String(formData.get('role') ?? '') as Role
  const teamId = String(formData.get('teamId') ?? '')
  const isActive = formData.get('isActive') === 'on'
  if (!id || !VAI_TRO_HOP_LE.includes(role)) return

  const mucTieu = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!mucTieu) return

  // Chặn leo thang quyền — quy tắc nằm trong lib/quyen.ts và có test riêng
  if (!duocSuaNguoiDung(u, { id, role: mucTieu.role }, { role, isActive }).ok) return

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
  const u = await batBuocQuyen('QT_NGUOI_DUNG')

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
  if (!duocDatLaiMatKhau(u, { id, role: mucTieu.role })) return

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
  const u = await batBuocQuyen('QT_TO')

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
  const u = await batBuocQuyen('QT_TO')

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
  const u = await batBuocQuyen('QT_CA')

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const isActive = formData.get('isActive') === 'on'
  if (!id || !name) veCa('Ca phải có tên.')
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))
    veCa('Giờ bắt đầu và kết thúc phải theo dạng 07:45.')

  await prisma.shift.update({ where: { id }, data: { name, startTime, endTime, isActive } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'SUA_CA', entityType: 'Shift', entityId: id, after: { name, startTime, endTime, isActive } },
  })

  veCa(`Đã lưu ca ${name}.`, false)
}

/**
 * Sửa một mốc giờ. Dữ liệu cũ KHÔNG bị ảnh hưởng: mỗi bản ghi đã lưu lại
 * mốc thật lúc nhập (slotStartAt / slotEndAt), nên báo cáo quá khứ giữ nguyên.
 */
export async function suaMocGio(formData: FormData): Promise<void> {
  const u = await batBuocQuyen('QT_CA')

  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const breakMinutes = Number(String(formData.get('breakMinutes') ?? '0'))
  const isActive = formData.get('isActive') === 'on'

  if (!id || !label) veCa('Mốc giờ phải có tên.')
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))
    veCa(`Mốc ${label}: giờ phải theo dạng 09:30.`)
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0)
    veCa(`Mốc ${label}: số phút nghỉ không hợp lệ.`)
  if (soPhut(startTime, endTime, breakMinutes) <= 0)
    veCa(`Mốc ${label}: nghỉ ${breakMinutes} phút dài hơn cả khoảng ${startTime}–${endTime}.`)

  const cu = await prisma.timeSlot.findUnique({ where: { id }, select: { shiftId: true } })
  await prisma.timeSlot.update({
    where: { id },
    data: { label, startTime, endTime, breakMinutes, isActive },
  })
  if (cu) await sapXepLaiMoc(cu.shiftId)

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_MOC_GIO',
      entityType: 'TimeSlot',
      entityId: id,
      after: { label, startTime, endTime, breakMinutes, isActive },
    },
  })

  veCa(`Đã lưu mốc ${label}.`, false)
}

export async function themMocGio(formData: FormData): Promise<void> {
  const u = await batBuocQuyen('QT_CA')

  const shiftId = String(formData.get('shiftId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const breakMinutes = Number(String(formData.get('breakMinutes') ?? '0'))
  if (!shiftId || !label) veCa('Mốc giờ mới phải có tên.')
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))
    veCa('Giờ của mốc mới phải theo dạng 09:30.')
  if (soPhut(startTime, endTime, Number.isFinite(breakMinutes) ? breakMinutes : 0) <= 0)
    veCa(`Mốc ${label}: nghỉ dài hơn cả khoảng ${startTime}–${endTime}.`)

  const trung = await prisma.timeSlot.findFirst({ where: { shiftId, label } })
  if (trung) veCa(`Ca này đã có mốc tên ${label} rồi.`)

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

  await sapXepLaiMoc(shiftId)

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_MOC_GIO', entityType: 'TimeSlot', entityId: s.id, after: { label } },
  })

  veCa(`Đã thêm mốc ${label}.`, false)
}

/** Đánh số lại mốc giờ theo giờ bắt đầu. Hai lượt vì có ràng buộc duy nhất (shiftId, seq). */
async function sapXepLaiMoc(shiftId: string) {
  const ds = await prisma.timeSlot.findMany({
    where: { shiftId },
    orderBy: { startTime: 'asc' },
    select: { id: true },
  })
  if (ds.length === 0) return
  await prisma.$transaction([
    ...ds.map((s, i) => prisma.timeSlot.update({ where: { id: s.id }, data: { seq: -(i + 1) } })),
    ...ds.map((s, i) => prisma.timeSlot.update({ where: { id: s.id }, data: { seq: i + 1 } })),
  ])
}

function veCa(thongBao: string, loi = true): never {
  redirect(`/quan-tri?tab=ca&${loi ? 'loi' : 'ok'}=${encodeURIComponent(thongBao)}`)
}

/** Thêm một ca làm việc mới, có thể chép sẵn bộ mốc giờ của ca đang dùng. */
export async function themCa(formData: FormData): Promise<void> {
  const u = await batBuocQuyen('QT_CA')

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const startTime = String(formData.get('startTime') ?? '').trim()
  const endTime = String(formData.get('endTime') ?? '').trim()
  const chepTu = String(formData.get('chepTu') ?? '')

  if (!code || !name) veCa('Nhập đủ mã ca và tên ca.')
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))
    veCa('Giờ bắt đầu và kết thúc phải theo dạng 07:45.')

  const trung = await prisma.shift.findUnique({ where: { code } })
  if (trung) veCa(`Mã ca ${code} đã có rồi (${trung.name}).`)

  const ca = await prisma.shift.create({ data: { code, name, startTime, endTime } })

  let soChep = 0
  if (chepTu) {
    const moc = await prisma.timeSlot.findMany({ where: { shiftId: chepTu }, orderBy: { seq: 'asc' } })
    if (moc.length > 0) {
      await prisma.timeSlot.createMany({
        data: moc.map((m) => ({
          shiftId: ca.id,
          seq: m.seq,
          label: m.label,
          startTime: m.startTime,
          endTime: m.endTime,
          breakMinutes: m.breakMinutes,
          graceMinutes: m.graceMinutes,
          isActive: m.isActive,
        })),
      })
      soChep = moc.length
    }
  }

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_CA', entityType: 'Shift', entityId: ca.id, after: { code, name, soChep } },
  })

  veCa(`Đã tạo ca ${name}${soChep > 0 ? ` và chép ${soChep} mốc giờ` : ''}.`, false)
}

/** Xoá một mốc giờ. Mốc đã có người nhập số liệu thì chỉ tắt, không xoá. */
export async function xoaMocGio(formData: FormData): Promise<void> {
  const u = await batBuocQuyen('QT_CA')

  const id = String(formData.get('id') ?? '')
  if (!id) veCa('Thiếu mốc giờ cần xoá.')

  const moc = await prisma.timeSlot.findUnique({
    where: { id },
    select: { label: true, shiftId: true, _count: { select: { entries: true } } },
  })
  if (!moc) veCa('Mốc giờ không còn tồn tại.')

  if (moc._count.entries > 0) {
    await prisma.timeSlot.update({ where: { id }, data: { isActive: false } })
    await prisma.auditLog.create({
      data: { userId: u.id, action: 'TAT_MOC_GIO', entityType: 'TimeSlot', entityId: id, after: { label: moc.label } },
    })
    veCa(
      `Mốc ${moc.label} đã có ${moc._count.entries} bản ghi sản lượng nên không xoá được — đã tắt để không dùng tiếp.`,
      false,
    )
  }

  await prisma.timeSlot.delete({ where: { id } })
  await sapXepLaiMoc(moc.shiftId)

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'XOA_MOC_GIO', entityType: 'TimeSlot', entityId: id, after: { label: moc.label } },
  })

  veCa(`Đã xoá mốc ${moc.label}.`, false)
}

/**
 * Lưu toàn bộ hồ sơ nhân sự trong một lần: vai trò, tổ, tình trạng làm việc và
 * danh sách chức năng được tích. Chức năng lưu dưới dạng chênh lệch so với bộ
 * mặc định của vai trò, để sau này sửa bộ mặc định thì mọi người ăn theo ngay.
 */
export async function luuNhanSu(input: {
  id: string
  role: string
  teamId: string
  tinhTrang: string
  ghiChu: string
  chucNang: string[]
}): Promise<{ ok?: true; loi?: string }> {
  const u = await batBuocQuyen('QT_NGUOI_DUNG')

  const role = input.role as Role
  if (!input.id) return { loi: 'Thiếu người cần sửa.' }
  if (!VAI_TRO_HOP_LE.includes(role)) return { loi: 'Vai trò không hợp lệ.' }
  if (!laTinhTrang(input.tinhTrang)) return { loi: 'Tình trạng làm việc không hợp lệ.' }

  const mucTieu = await prisma.user.findUnique({
    where: { id: input.id },
    select: { role: true, fullName: true },
  })
  if (!mucTieu) return { loi: 'Không tìm thấy người này.' }

  // Nghỉ việc thì tài khoản ngừng hoạt động luôn, khỏi phải nhớ tắt thêm một ô
  const isActive = input.tinhTrang !== 'NGHI_VIEC'

  // Chặn leo thang quyền — quy tắc nằm trong lib/quyen.ts và có test riêng
  const duoc = duocSuaNguoiDung(u, { id: input.id, role: mucTieu.role }, { role, isActive })
  if (!duoc.ok) return { loi: duoc.loi ?? 'Bạn không sửa được người này.' }

  const { them, bot } = tachThemBot(role, input.chucNang)

  await prisma.user.update({
    where: { id: input.id },
    data: {
      role,
      teamId: input.teamId || null,
      tinhTrang: input.tinhTrang,
      ghiChu: input.ghiChu.trim() || null,
      isActive,
      quyenThem: them,
      quyenBot: bot,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_NHAN_SU',
      entityType: 'User',
      entityId: input.id,
      after: { role, tinhTrang: input.tinhTrang, isActive, them, bot },
    },
  })

  revalidatePath('/quan-tri')
  return { ok: true }
}

/** Thêm tổ ngay trong tab danh sách nhân sự, có báo lỗi rõ ràng. */
export async function themToNhanh(input: {
  code: string
  name: string
}): Promise<{ ok?: true; loi?: string }> {
  const u = await batBuocQuyen('QT_TO')

  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  if (!code || !name) return { loi: 'Nhập đủ mã tổ và tên tổ.' }

  const trung = await prisma.team.findUnique({ where: { code } })
  if (trung) return { loi: `Mã tổ ${code} đã dùng cho "${trung.name}".` }

  const to = await prisma.team.create({ data: { code, name } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_TO', entityType: 'Team', entityId: to.id, after: { code, name } },
  })

  revalidatePath('/quan-tri')
  return { ok: true }
}
