/**
 * Phiên đăng nhập: JWT ký HS256 đặt trong cookie HttpOnly.
 * Không dùng localStorage, không gửi token ra client.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@prisma/client'

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
}

export async function taoPhien(u: NguoiDung): Promise<void> {
  const token = await new SignJWT({ ...u })
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

export async function nguoiDangDangNhap(): Promise<NguoiDung | null> {
  const store = await cookies()
  const token = store.get(TEN_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, khoa())
    return {
      id: String(payload.id),
      employeeCode: String(payload.employeeCode),
      fullName: String(payload.fullName),
      role: payload.role as Role,
      teamId: payload.teamId ? String(payload.teamId) : null,
    }
  } catch {
    return null
  }
}

/** Dùng trong server component / server action: không có phiên thì ném lỗi. */
export async function batBuocDangNhap(...vaiTro: Role[]): Promise<NguoiDung> {
  const u = await nguoiDangDangNhap()
  if (!u) throw new Error('CHUA_DANG_NHAP')
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
