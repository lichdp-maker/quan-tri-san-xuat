import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '@prisma/client'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { ngayHomNay, dinhDangNgay, gioHienTai } from '@/lib/date'
import { dangXuat } from './dang-nhap/actions'
import {
  IconBieuDo,
  IconPhieu,
  IconNguoi,
  IconDongHo,
  IconBanhRang,
  IconKhoa,
  IconChiaKhoa,
  IconMuiTenPhai,
  IconDauTich,
  IconThoat,
} from '@/components/Icons'

export const dynamic = 'force-dynamic'

type Muc = {
  ten: string
  mo: string
  href: string
  mau: string
  icon: React.ReactNode
  vaiTro: Role[]
}

const TAT_CA: Role[] = [
  'WORKER',
  'TEAM_LEADER',
  'ENGINEER',
  'WAREHOUSE',
  'PLANNER',
  'SHOP_MANAGER',
  'DEPUTY_DIRECTOR',
  'DIRECTOR',
]
const QUAN_LY: Role[] = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

const MUC: Muc[] = [
  {
    ten: 'Nhập sản lượng',
    mo: 'Chốt số theo mốc giờ cho từng nguyên công được giao, khai số đạt, số hỏng và thời gian dừng',
    href: '/cong-nhan',
    mau: 'from-emerald-500 to-emerald-700',
    icon: <IconDongHo />,
    vaiTro: ['WORKER', 'TEAM_LEADER'],
  },
  {
    ten: 'Chốt số · Phân công',
    mo: 'Gán công nhân vào nguyên công theo lệnh, duyệt bản ghi, xem ai chưa nhập và tiến độ lệnh',
    href: '/to-truong',
    mau: 'from-amber-500 to-orange-600',
    icon: <IconNguoi />,
    vaiTro: ['TEAM_LEADER', ...QUAN_LY],
  },
  {
    ten: 'Lệnh sản xuất',
    mo: 'Tạo và phát hành lệnh, sinh nguyên công từ định mức, theo dõi tiến độ và đóng lệnh',
    href: '/lenh-san-xuat',
    mau: 'from-brand-500 to-brand-700',
    icon: <IconPhieu />,
    vaiTro: ['PLANNER', ...QUAN_LY],
  },
  {
    ten: 'Kỹ thuật',
    mo: 'Khai báo sản phẩm và nguyên công, sửa định mức giây, xử lý phiếu sai hỏng theo nguyên nhân',
    href: '/ky-thuat',
    mau: 'from-teal-500 to-cyan-700',
    icon: <IconBanhRang />,
    vaiTro: ['ENGINEER', ...QUAN_LY],
  },
  {
    ten: 'Bảng tổng hợp',
    mo: 'Năng suất theo người và theo tổ, tiến độ lệnh, cảnh báo trễ hạn, Pareto sai hỏng, xuất Excel',
    href: '/bang-dieu-khien',
    mau: 'from-indigo-500 to-violet-700',
    icon: <IconBieuDo />,
    vaiTro: ['PLANNER', 'ENGINEER', 'WAREHOUSE', ...QUAN_LY],
  },
  {
    ten: 'Quản trị',
    mo: 'Tài khoản và phân quyền, tổ sản xuất, ca làm việc và các mốc giờ chốt số',
    href: '/quan-tri',
    mau: 'from-slate-600 to-slate-800',
    icon: <IconKhoa />,
    vaiTro: QUAN_LY,
  },
  {
    ten: 'Đổi mật khẩu',
    mo: 'Đổi mật khẩu hoặc mã PIN của chính bạn',
    href: '/doi-mat-khau',
    mau: 'from-rose-500 to-pink-600',
    icon: <IconChiaKhoa />,
    vaiTro: TAT_CA,
  },
]

export default async function TrangChu() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')

  const ds = MUC.filter((m) => m.vaiTro.includes(u.role))
  const ymd = ngayHomNay()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="o-icon bg-gradient-to-br from-brand-500 to-brand-700">
            <IconDauTich />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">{u.fullName}</p>
            <p className="text-sm text-slate-500">
              {u.employeeCode} · {TEN_VAI_TRO[u.role]}
            </p>
          </div>
        </div>
        <form action={dangXuat}>
          <button className="nut-phu flex items-center gap-1.5">
            <IconThoat />
            Thoát
          </button>
        </form>
      </header>

      <div className="the mb-6 flex items-center justify-between bg-gradient-to-r from-brand-600 to-indigo-600 text-white">
        <div>
          <p className="text-sm/5 text-white/80">Hôm nay</p>
          <p className="text-2xl font-bold leading-tight">{dinhDangNgay(ymd)}</p>
        </div>
        <p className="text-3xl font-bold tabular-nums">{gioHienTai()}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ds.map((m) => (
          <Link key={m.href} href={m.href} className="the-bam group flex items-center gap-4">
            <span className={`o-icon bg-gradient-to-br ${m.mau}`}>{m.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">{m.ten}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate-500">{m.mo}</span>
            </span>
            <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400">
              <IconMuiTenPhai />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Hệ thống theo dõi sản xuất · EMIC-GEIC
      </p>
    </main>
  )
}
