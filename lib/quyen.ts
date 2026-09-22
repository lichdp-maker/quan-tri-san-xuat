/**
 * Quy tắc phân quyền — nguồn duy nhất của sự thật.
 *
 * Tách hẳn khỏi server action để test được từng nhánh mà không cần CSDL.
 * Mọi action chỉ nạp dữ liệu rồi hỏi các hàm ở đây, không tự suy luận lại.
 */
import type { OrderStatus, Role } from '@prisma/client'

/** Thứ bậc quyền. Số lớn hơn thì tác động được lên số nhỏ hơn. */
const CAP: Record<Role, number> = {
  WORKER: 1,
  TEAM_LEADER: 2,
  ENGINEER: 2,
  WAREHOUSE: 2,
  PLANNER: 2,
  SHOP_MANAGER: 3,
  DEPUTY_DIRECTOR: 4,
  DIRECTOR: 5,
}

/** true khi nguoiGoi được phép tác động lên tài khoản có vai trò mucTieu. */
export function caoHon(nguoiGoi: Role, mucTieu: Role): boolean {
  return CAP[nguoiGoi] > CAP[mucTieu]
}

/**
 * Tổ trưởng chỉ thao tác trong tổ mình; cấp quản lý thì toàn xưởng.
 * Trả về true nghĩa là KHÔNG được phép.
 */
export function ngoaiPhamViTo(
  vaiTro: Role,
  toCuaNguoiGoi: string | null,
  toCuaDoiTuong: string | null,
): boolean {
  if (vaiTro !== 'TEAM_LEADER') return false
  if (!toCuaNguoiGoi) return true
  return toCuaDoiTuong !== toCuaNguoiGoi
}

export type NguoiGoi = { id: string; role: Role; teamId: string | null }

/**
 * Được duyệt hoặc từ chối một bản ghi sản lượng hay không.
 *
 * Hai điều kiện, cả hai đều bắt buộc:
 *  - không phải sản lượng của chính mình (tự chấm điểm cho mình)
 *  - tổ trưởng thì bản ghi phải thuộc tổ mình
 */
export function duocDuyetBanGhi(
  nguoiGoi: NguoiGoi,
  banGhi: { userId: string; teamId: string | null },
): boolean {
  if (banGhi.userId === nguoiGoi.id) return false
  return !ngoaiPhamViTo(nguoiGoi.role, nguoiGoi.teamId, banGhi.teamId)
}

/**
 * Bộ lọc Prisma tương đương duocDuyetBanGhi, dùng cho truy vấn theo lô.
 * Để một chỗ duy nhất định nghĩa quy tắc, tránh bản lọc và bản kiểm lệch nhau.
 */
export function locBanGhiDuocDuyet(nguoiGoi: NguoiGoi) {
  return {
    userId: { not: nguoiGoi.id },
    ...(nguoiGoi.role === 'TEAM_LEADER' ? { teamId: nguoiGoi.teamId ?? '\u0000' } : {}),
  }
}

/** Lệnh còn nhận sản lượng hay không. Lệnh đã đóng thì không ghi thêm được. */
export function lenhConNhanSanLuong(trangThai: OrderStatus): boolean {
  return trangThai === 'RELEASED' || trangThai === 'IN_PROGRESS'
}

export type KetQuaSuaNguoiDung = { ok: true } | { ok: false; lyDo: string }

/**
 * Được sửa một tài khoản hay không — chặn leo thang quyền.
 *
 * Bốn điều cấm:
 *  - tự khoá chính mình (khoá hết người quản trị thì không ai vào được nữa)
 *  - tự đổi vai trò của chính mình
 *  - sửa người có cấp ngang hoặc cao hơn mình
 *  - cấp cho ai đó vai trò ngang hoặc cao hơn mình
 */
export function duocSuaNguoiDung(
  nguoiGoi: NguoiGoi,
  mucTieu: { id: string; role: Role },
  thayDoi: { role: Role; isActive: boolean },
): KetQuaSuaNguoiDung {
  const laChinhMinh = mucTieu.id === nguoiGoi.id

  if (laChinhMinh && !thayDoi.isActive) {
    return { ok: false, lyDo: 'Không tự khoá tài khoản của chính mình.' }
  }
  if (laChinhMinh && thayDoi.role !== mucTieu.role) {
    return { ok: false, lyDo: 'Không tự đổi vai trò của chính mình.' }
  }
  if (!laChinhMinh && !caoHon(nguoiGoi.role, mucTieu.role)) {
    return { ok: false, lyDo: 'Chỉ sửa được tài khoản có cấp thấp hơn mình.' }
  }
  if (thayDoi.role !== mucTieu.role && !caoHon(nguoiGoi.role, thayDoi.role)) {
    return { ok: false, lyDo: 'Không cấp được vai trò ngang hoặc cao hơn mình.' }
  }
  return { ok: true }
}

/** Khoảng đệm vì iat của JWT chỉ tính đến giây, passwordChangedAt tính đến mili giây. */
export const DEM_GIAY = 5

/**
 * Phiên còn hiệu lực hay không.
 *
 * Tách ra khỏi lib/session.ts để test được: bên đó phải đụng cookie và jose nên
 * chỉ chạy được trong môi trường của Next, còn quyết định thì nằm gọn ở đây.
 *
 * @param capLucGiay  giá trị iat của token, tính bằng giây
 * @param doiMatKhauLuc  lần đổi mật khẩu gần nhất, null nếu chưa từng đổi
 */
export function phienConHieuLuc(
  capLucGiay: number,
  doiMatKhauLuc: Date | null,
  dangLamViec: boolean,
): boolean {
  if (!dangLamViec) return false
  if (!doiMatKhauLuc) return true
  if (capLucGiay <= 0) return true
  return capLucGiay * 1000 >= doiMatKhauLuc.getTime() - DEM_GIAY * 1000
}

/** Được đặt lại mật khẩu cho tài khoản này hay không. */
export function duocDatLaiMatKhau(nguoiGoi: NguoiGoi, mucTieu: { id: string; role: Role }): boolean {
  if (mucTieu.id === nguoiGoi.id) return true
  return caoHon(nguoiGoi.role, mucTieu.role)
}
