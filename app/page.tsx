import { redirect } from 'next/navigation'
import { nguoiDangDangNhap } from '@/lib/session'
import { trangDauTien } from '@/lib/chuc-nang'

/**
 * Sau khi đăng nhập: quản lý và văn phòng vào thẳng bảng tổng hợp,
 * công nhân và tổ trưởng vào thẳng màn hình công việc của mình.
 */
export default async function Trang() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  // Còn dùng mật khẩu cấp sẵn thì phải đổi trước khi vào bất cứ đâu
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  // Đưa về đúng màn hình chính theo CHỨC NĂNG người đó có, không theo vai trò —
  // quản trị cắt bớt chức năng thì trang mặc định đổi theo luôn.
  redirect(trangDauTien(u.quyen))
}
