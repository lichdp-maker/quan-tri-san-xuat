'use server'

import { redirect } from 'next/navigation'
import { verify } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { taoPhien, xoaPhien, trangChinh } from '@/lib/session'

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

  redirect(trangChinh(u.role))
}

export async function dangXuat(): Promise<void> {
  await xoaPhien()
  redirect('/dang-nhap')
}
