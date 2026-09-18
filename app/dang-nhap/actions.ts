'use server'

import { redirect } from 'next/navigation'
import { verify } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { taoPhien, xoaPhien } from '@/lib/session'

export type KetQuaDangNhap = { loi?: string }

export async function dangNhap(_truoc: KetQuaDangNhap, form: FormData): Promise<KetQuaDangNhap> {
  const ma = String(form.get('employeeCode') ?? '').trim().toUpperCase()
  const matKhau = String(form.get('password') ?? '')

  if (!ma || !matKhau) return { loi: 'Nhập mã nhân viên và mật khẩu.' }

  const u = await prisma.user.findUnique({ where: { employeeCode: ma } })
  if (!u || !u.isActive) return { loi: 'Mã nhân viên không đúng hoặc đã bị khoá.' }

  let dung = false
  try {
    dung = await verify(u.passwordHash, matKhau)
  } catch {
    dung = false
  }
  if (!dung) return { loi: 'Mật khẩu không đúng.' }

  await taoPhien({
    id: u.id,
    employeeCode: u.employeeCode,
    fullName: u.fullName,
    role: u.role,
    teamId: u.teamId,
  })

  redirect('/')
}

/**
 * Tra tên theo mã nhân viên để hiện ngay dưới ô nhập.
 * Chỉ trả về họ tên — công nhân biết mình gõ đúng mã trước khi nhập PIN.
 */
export async function timTen(ma: string): Promise<string | null> {
  const code = ma.trim().toUpperCase()
  if (code.length < 3) return null
  const u = await prisma.user.findUnique({
    where: { employeeCode: code },
    select: { fullName: true, isActive: true },
  })
  return u && u.isActive ? u.fullName : null
}

export async function dangXuat(): Promise<void> {
  await xoaPhien()
  redirect('/dang-nhap')
}
