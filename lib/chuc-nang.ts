/**
 * Danh mục CHỨC NĂNG của hệ thống và cách một người có được chức năng nào.
 *
 * Vai trò (Role) chỉ là bộ mặc định cho nhanh. Quản trị vẫn tích/bỏ tích từng
 * chức năng cho từng người: ai cũng có thể được thêm việc ngoài vai trò, hoặc
 * bị cắt bớt một phần việc của vai trò mình.
 *
 * Toàn bộ là hàm thuần để test được, không đụng tới CSDL hay phiên đăng nhập.
 */

import type { Role } from '@prisma/client'

export type MaChucNang =
  // Sản xuất
  | 'XEM_TONG_HOP'
  | 'XEM_MAT_BANG'
  | 'SAP_XEP_MAT_BANG'
  | 'XEP_NHAN_SU'
  | 'CHOT_SO'
  | 'NHAP_SAN_LUONG'
  | 'QUAN_LY_LENH'
  // Kỹ thuật
  | 'XEM_DONG_CHAY'
  | 'SUA_DONG_CHAY'
  | 'DINH_MUC'
  // Hệ thống
  | 'QT_NGUOI_DUNG'
  | 'QT_TO'
  | 'QT_CA'

export type MucChucNang = { ma: MaChucNang; ten: string; moTa: string }

export const NHOM_CHUC_NANG: Array<{ nhom: string; muc: MucChucNang[] }> = [
  {
    nhom: 'Sản xuất',
    muc: [
      { ma: 'XEM_TONG_HOP', ten: 'Xem bảng tổng hợp', moTa: 'Biểu đồ sản lượng, năng suất, sai hỏng toàn xưởng' },
      { ma: 'XEM_MAT_BANG', ten: 'Xem sơ đồ mặt bằng', moTa: 'Vị trí các chuyền và chỗ nào đã có người' },
      { ma: 'SAP_XEP_MAT_BANG', ten: 'Cấu hình chuyền · mặt bằng', moTa: 'Thêm/sửa chuyền, chọn nguyên công, kéo đổi vị trí trên mặt bằng' },
      { ma: 'XEP_NHAN_SU', ten: 'Xếp nhân sự vào chỗ', moTa: 'Gán người và nguyên công cho từng chỗ ngồi' },
      { ma: 'CHOT_SO', ten: 'Chốt số · duyệt sản lượng', moTa: 'Duyệt hoặc trả lại bản ghi công nhân nhập' },
      { ma: 'NHAP_SAN_LUONG', ten: 'Nhập sản lượng', moTa: 'Màn hình nhập số theo mốc giờ của công nhân' },
      { ma: 'QUAN_LY_LENH', ten: 'Quản lý lệnh sản xuất', moTa: 'Tạo, phát hành, theo dõi lệnh' },
    ],
  },
  {
    nhom: 'Kỹ thuật',
    muc: [
      { ma: 'XEM_DONG_CHAY', ten: 'Xem sơ đồ dòng chảy', moTa: 'Thứ tự nguyên công của sản phẩm' },
      { ma: 'SUA_DONG_CHAY', ten: 'Sửa sơ đồ dòng chảy', moTa: 'Thêm, xoá, kéo đổi thứ tự nguyên công' },
      { ma: 'DINH_MUC', ten: 'Định mức · phiếu lỗi', moTa: 'Sửa định mức giây, loại lỗi, lý do dừng' },
    ],
  },
  {
    nhom: 'Hệ thống',
    muc: [
      { ma: 'QT_NGUOI_DUNG', ten: 'Quản trị người dùng', moTa: 'Thêm người, đổi vai trò, đặt lại mật khẩu, phân quyền' },
      { ma: 'QT_TO', ten: 'Quản trị tổ sản xuất', moTa: 'Thêm tổ, gán tổ trưởng' },
      { ma: 'QT_CA', ten: 'Quản trị ca · mốc giờ', moTa: 'Thêm ca, sửa mốc giờ báo sản lượng' },
    ],
  },
]

export const MOI_CHUC_NANG: MaChucNang[] = NHOM_CHUC_NANG.flatMap((n) => n.muc.map((m) => m.ma))

export const TEN_CHUC_NANG: Record<MaChucNang, string> = Object.fromEntries(
  NHOM_CHUC_NANG.flatMap((n) => n.muc.map((m) => [m.ma, m.ten])),
) as Record<MaChucNang, string>

/** Bộ chức năng mặc định của từng vai trò. Quản trị vẫn chỉnh lại được cho từng người. */
export const MAC_DINH: Record<Role, MaChucNang[]> = {
  WORKER: ['NHAP_SAN_LUONG'],
  TEAM_LEADER: ['NHAP_SAN_LUONG', 'XEM_MAT_BANG', 'XEP_NHAN_SU', 'CHOT_SO', 'XEM_DONG_CHAY'],
  ENGINEER: ['XEM_TONG_HOP', 'XEM_MAT_BANG', 'XEM_DONG_CHAY', 'SUA_DONG_CHAY', 'DINH_MUC'],
  WAREHOUSE: ['XEM_TONG_HOP', 'XEM_MAT_BANG'],
  PLANNER: ['XEM_TONG_HOP', 'XEM_MAT_BANG', 'QUAN_LY_LENH', 'XEM_DONG_CHAY'],
  SHOP_MANAGER: MOI_CHUC_NANG,
  DEPUTY_DIRECTOR: MOI_CHUC_NANG,
  DIRECTOR: MOI_CHUC_NANG,
}

function laMa(x: string): x is MaChucNang {
  return (MOI_CHUC_NANG as string[]).includes(x)
}

/**
 * Chức năng thật sự của một người = mặc định của vai trò + phần được thêm − phần bị cắt.
 * Cắt thắng thêm, để quản trị chặn được dứt khoát một chức năng.
 */
export function quyenCuaNguoi(role: Role, them: string[] = [], bot: string[] = []): MaChucNang[] {
  const co = new Set<MaChucNang>(MAC_DINH[role] ?? [])
  for (const x of them) if (laMa(x)) co.add(x)
  for (const x of bot) if (laMa(x)) co.delete(x)
  return MOI_CHUC_NANG.filter((m) => co.has(m))
}

export function coQuyen(quyen: readonly string[], ...ma: MaChucNang[]): boolean {
  return ma.some((m) => quyen.includes(m))
}

/**
 * Đổi danh sách chức năng đã tích trên giao diện thành cặp (thêm, bớt) so với
 * mặc định của vai trò — lưu chênh lệch chứ không lưu cả bộ, để sau này sửa bộ
 * mặc định của vai trò thì mọi người ăn theo ngay.
 */
export function tachThemBot(
  role: Role,
  daChon: string[],
): { them: MaChucNang[]; bot: MaChucNang[] } {
  const mac = new Set<MaChucNang>(MAC_DINH[role] ?? [])
  const chon = new Set(daChon.filter(laMa))
  return {
    them: MOI_CHUC_NANG.filter((m) => chon.has(m) && !mac.has(m)),
    bot: MOI_CHUC_NANG.filter((m) => !chon.has(m) && mac.has(m)),
  }
}

/** Trang mặc định sau khi đăng nhập, chọn theo chức năng người đó thật sự có. */
export function trangDauTien(quyen: readonly string[]): string {
  if (coQuyen(quyen, 'XEM_TONG_HOP')) return '/bang-dieu-khien'
  if (coQuyen(quyen, 'QUAN_LY_LENH')) return '/lenh-san-xuat'
  if (coQuyen(quyen, 'CHOT_SO')) return '/to-truong'
  if (coQuyen(quyen, 'XEP_NHAN_SU')) return '/day-chuyen'
  if (coQuyen(quyen, 'DINH_MUC', 'SUA_DONG_CHAY')) return '/ky-thuat'
  if (coQuyen(quyen, 'NHAP_SAN_LUONG')) return '/cong-nhan'
  if (coQuyen(quyen, 'XEM_MAT_BANG')) return '/so-do-xuong'
  return '/doi-mat-khau'
}
