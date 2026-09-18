import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, trangChinh } from '@/lib/session'

export default async function Trang() {
  const u = await nguoiDangDangNhap()
  redirect(u ? trangChinh(u.role) : '/dang-nhap')
}
