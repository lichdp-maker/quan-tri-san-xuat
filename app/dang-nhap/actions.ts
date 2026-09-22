'use server'

import { redirect } from 'next/navigation'
import { hash, verify } from '@node-rs/argon2'
import { prisma } from '@/lib/prisma'
import { taoPhien, xoaPhien } from '@/lib/session'

export type KetQuaDangNhap = { loi?: string }

/** Sai quá số lần này thì khoá tạm tài khoản. */
const SO_LAN_TOI_DA = 5
const PHUT_KHOA = 15

/** Một thông báo duy nhất cho mọi kiểu sai — không hé lộ mã nào có thật. */
const SAI = 'Mã nhân viên hoặc mật khẩu không đúng.'

/**
 * Băm giả, để lượt gõ sai mã nhân viên tốn thời gian ngang lượt sai mật khẩu.
 * Không có nó, người ngoài đo thời gian phản hồi là biết mã nào tồn tại.
 */
let bamGia: string | null = null
async function bamGiaLap(): Promise<string> {
  if (!bamGia) bamGia = await hash(`khong-ai-dung-${Date.now()}`)
  return bamGia
}

export async function dangNhap(_truoc: KetQuaDangNhap, form: FormData): Promise<KetQuaDangNhap> {
  const ma = String(form.get('employeeCode') ?? '')
    .trim()
    .toUpperCase()
  const matKhau = String(form.get('password') ?? '')

  if (!ma || !matKhau) return { loi: 'Nhập mã nhân viên và mật khẩu.' }

  const u = await prisma.user.findUnique({ where: { employeeCode: ma } })

  // Đang bị khoá tạm vì sai nhiều lần
  if (u?.lockedUntil && u.lockedUntil > new Date()) {
    const conLai = Math.max(1, Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000))
    return { loi: `Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ${conLai} phút.` }
  }

  let dung = false
  try {
    dung = await verify(u && u.isActive ? u.passwordHash : await bamGiaLap(), matKhau)
  } catch {
    dung = false
  }

  if (!u || !u.isActive) return { loi: SAI }

  if (!dung) {
    const soLan = u.failedLogins + 1
    const khoa = soLan >= SO_LAN_TOI_DA
    await prisma.user.update({
      where: { id: u.id },
      data: {
        failedLogins: khoa ? 0 : soLan,
        lockedUntil: khoa ? new Date(Date.now() + PHUT_KHOA * 60000) : null,
      },
    })
    return khoa
      ? { loi: `Sai ${SO_LAN_TOI_DA} lần liên tiếp. Tài khoản tạm khoá ${PHUT_KHOA} phút.` }
      : { loi: SAI }
  }

  if (u.failedLogins > 0 || u.lockedUntil) {
    await prisma.user.update({
      where: { id: u.id },
      data: { failedLogins: 0, lockedUntil: null },
    })
  }

  await taoPhien({ id: u.id })

  redirect(u.mustChangePassword ? '/doi-mat-khau' : '/')
}

/** "Nguyễn Thị Thu Hà" thành "N. T. T. Hà" — đủ để người đó nhận ra mình. */
function rutGonTen(ten: string): string {
  const phan = ten.trim().split(/\s+/)
  if (phan.length <= 1) return ten
  const cuoi = phan[phan.length - 1]
  return `${phan
    .slice(0, -1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ')} ${cuoi}`
}

/** Đếm số lần tra theo tiền tố mã, chặn dò danh sách nhân sự hàng loạt. */
const demTra = new Map<string, { so: number; phut: number }>()

/**
 * Tra tên theo mã nhân viên để hiện ngay dưới ô nhập — công nhân biết mình gõ
 * đúng mã trước khi bấm PIN.
 *
 * Đây là cửa duy nhất không cần đăng nhập, nên siết lại: chỉ trả lời khi mã
 * khớp CHÍNH XÁC và đủ dài, chỉ trả tên rút gọn, và giới hạn số lần hỏi.
 */
export async function timTen(ma: string): Promise<string | null> {
  const code = ma.trim().toUpperCase()
  if (code.length < 6) return null

  const phut = Math.floor(Date.now() / 60000)
  const khoa = code.slice(0, 4)
  const cu = demTra.get(khoa)
  if (cu && cu.phut === phut) {
    if (cu.so >= 30) return null
    cu.so += 1
  } else {
    demTra.set(khoa, { so: 1, phut })
  }

  const u = await prisma.user.findUnique({
    where: { employeeCode: code },
    select: { fullName: true, isActive: true },
  })
  if (!u || !u.isActive) return null
  return rutGonTen(u.fullName)
}

export async function dangXuat(): Promise<void> {
  await xoaPhien()
  redirect('/dang-nhap')
}
