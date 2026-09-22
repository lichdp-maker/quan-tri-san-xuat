/**
 * Phiên đăng nhập: JWT ký HS256 đặt trong cookie HttpOnly.
 * Không dùng localStorage, không gửi token ra client.
 */
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@prisma/client'
import { prisma } from './prisma'
import { phienConHieuLuc } from './quyen'

const TEN_COOKIE = 'phien'
const HAN_NGAY = 30

function khoa(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('Thiếu AUTH_SECRET trong .env')
  return new TextEncoder().encode(s)
}

export type NguoiDung = {
  id: string
  employeeCode: string
  fullName: string
  role: Role
  teamId: string | null
  /** true = chưa đổi mật khẩu mặc định, phải đổi trước khi dùng hệ thống */
  phaiDoiMatKhau: boolean
}

export async function taoPhien(u: { id: string }): Promise<void> {
  const token = await new SignJWT({ id: u.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${HAN_NGAY}d`)
    .sign(khoa())

  const store = await cookies()
  store.set(TEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: HAN_NGAY * 24 * 60 * 60,
  })
}

export async function xoaPhien(): Promise<void> {
  const store = await cookies()
  store.delete(TEN_COOKIE)
}

/**
 * Người đang đăng nhập.
 *
 * Token chỉ mang id. Vai trò, tổ và trạng thái làm việc luôn đọc lại từ CSDL,
 * để: khoá tài khoản có hiệu lực ngay, hạ quyền có hiệu lực ngay, chuyển tổ có
 * hiệu lực ngay, và đổi mật khẩu thì mọi phiên cũ hết hiệu lực.
 *
 * Bọc trong cache() của React nên mỗi lượt yêu cầu chỉ truy vấn CSDL một lần,
 * dù layout, trang và server action cùng gọi.
 */
export const nguoiDangDangNhap = cache(async (): Promise<NguoiDung | null> => {
  const store = await cookies()
  const token = store.get(TEN_COOKIE)?.value
  if (!token) return null

  let id = ''
  let capLuc = 0
  try {
    const { payload } = await jwtVerify(token, khoa())
    id = String(payload.id ?? '')
    capLuc = Number(payload.iat ?? 0)
  } catch {
    return null
  }
  if (!id) return null

  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      role: true,
      teamId: true,
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: true,
    },
  })
  if (!u) return null

  // Quy tắc nằm trong lib/quyen.ts và có test riêng: tài khoản bị khoá thì mất
  // phiên ngay, và phiên cấp trước lần đổi mật khẩu gần nhất cũng hết hiệu lực.
  if (!phienConHieuLuc(capLuc, u.passwordChangedAt, u.isActive)) return null

  return {
    id: u.id,
    employeeCode: u.employeeCode,
    fullName: u.fullName,
    role: u.role,
    teamId: u.teamId,
    phaiDoiMatKhau: u.mustChangePassword,
  }
})

/**
 * Dùng trong server component / server action: không có phiên thì ném lỗi.
 * Người còn cờ "phải đổi mật khẩu" bị chặn mọi thao tác cho tới khi đổi xong —
 * trang đổi mật khẩu gọi thẳng nguoiDangDangNhap() nên không vướng.
 */
export async function batBuocDangNhap(...vaiTro: Role[]): Promise<NguoiDung> {
  const u = await nguoiDangDangNhap()
  if (!u) throw new Error('CHUA_DANG_NHAP')
  if (u.phaiDoiMatKhau) throw new Error('PHAI_DOI_MAT_KHAU')
  if (vaiTro.length > 0 && !vaiTro.includes(u.role)) throw new Error('KHONG_CO_QUYEN')
  return u
}


/** Trang mặc định theo vai trò. */
export function trangChinh(role: Role): string {
  switch (role) {
    case 'WORKER':
      return '/cong-nhan'
    case 'TEAM_LEADER':
      return '/to-truong'
    case 'PLANNER':
      return '/lenh-san-xuat'
    case 'ENGINEER':
      return '/ky-thuat'
    default:
      return '/bang-dieu-khien'
  }
}

export const TEN_VAI_TRO: Record<Role, string> = {
  WORKER: 'Công nhân',
  TEAM_LEADER: 'Tổ trưởng',
  ENGINEER: 'Nhân viên kỹ thuật',
  WAREHOUSE: 'Nhân viên kho',
  PLANNER: 'Nhân viên kinh tế',
  SHOP_MANAGER: 'Quản lý xưởng',
  DEPUTY_DIRECTOR: 'Phó giám đốc',
  DIRECTOR: 'Giám đốc',
}
