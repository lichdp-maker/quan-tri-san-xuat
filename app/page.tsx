import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'

/**
 * Sau khi đăng nhập: quản lý và văn phòng vào thẳng bảng tổng hợp,
 * công nhân và tổ trưởng vào thẳng màn hình công việc của mình.
 */
export default async function Trang() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  // Còn dùng mật khẩu cấp sẵn thì phải đổi trước khi vào bất cứ đâu
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (u.role === 'WORKER') redirect('/cong-nhan')
  if (u.role === 'TEAM_LEADER') redirect('/to-truong')
  redirect('/bang-dieu-khien')
}
