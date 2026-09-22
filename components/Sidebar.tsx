'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Role } from '@prisma/client'
import {
  IconBieuDo,
  IconPhieu,
  IconNguoi,
  IconDongHo,
  IconBanhRang,
  IconKhoa,
  IconChiaKhoa,
  IconDauTich,
  IconSoDo,
  IconDongChay,
  IconMatBang,
} from './Icons'

type Muc = { ten: string; href: string; icon: React.ReactNode; vaiTro: Role[] }
type Nhom = { nhan: string; muc: Muc[] }

const QUAN_LY: Role[] = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']
const TAT_CA: Role[] = [
  'WORKER',
  'TEAM_LEADER',
  'ENGINEER',
  'WAREHOUSE',
  'PLANNER',
  ...QUAN_LY,
]

const NHOM: Nhom[] = [
  {
    nhan: 'Sản xuất',
    muc: [
      {
        ten: 'Bảng tổng hợp',
        href: '/bang-dieu-khien',
        icon: <IconBieuDo className="h-5 w-5" />,
        vaiTro: ['PLANNER', 'ENGINEER', 'WAREHOUSE', ...QUAN_LY],
      },
      {
        ten: 'Nhập sản lượng',
        href: '/cong-nhan',
        icon: <IconDongHo className="h-5 w-5" />,
        vaiTro: ['WORKER', 'TEAM_LEADER'],
      },
      {
        ten: 'Mặt bằng xưởng',
        href: '/so-do-xuong',
        icon: <IconMatBang className="h-5 w-5" />,
        vaiTro: ['TEAM_LEADER', 'ENGINEER', 'PLANNER', 'WAREHOUSE', ...QUAN_LY],
      },
      {
        ten: 'Sơ đồ dây chuyền',
        href: '/day-chuyen',
        icon: <IconSoDo className="h-5 w-5" />,
        vaiTro: ['TEAM_LEADER', ...QUAN_LY],
      },
      {
        ten: 'Chốt số · Phân công',
        href: '/to-truong',
        icon: <IconNguoi className="h-5 w-5" />,
        vaiTro: ['TEAM_LEADER', ...QUAN_LY],
      },
      {
        ten: 'Lệnh sản xuất',
        href: '/lenh-san-xuat',
        icon: <IconPhieu className="h-5 w-5" />,
        vaiTro: ['PLANNER', ...QUAN_LY],
      },
    ],
  },
  {
    nhan: 'Kỹ thuật',
    muc: [
      {
        ten: 'Sơ đồ dòng chảy',
        href: '/dong-chay',
        icon: <IconDongChay className="h-5 w-5" />,
        vaiTro: ['ENGINEER', 'PLANNER', 'TEAM_LEADER', ...QUAN_LY],
      },
      {
        ten: 'Định mức · Phiếu lỗi',
        href: '/ky-thuat',
        icon: <IconBanhRang className="h-5 w-5" />,
        vaiTro: ['ENGINEER', ...QUAN_LY],
      },
    ],
  },
  {
    nhan: 'Hệ thống',
    muc: [
      {
        ten: 'Quản trị',
        href: '/quan-tri',
        icon: <IconKhoa className="h-5 w-5" />,
        vaiTro: QUAN_LY,
      },
      {
        ten: 'Đổi mật khẩu',
        href: '/doi-mat-khau',
        icon: <IconChiaKhoa className="h-5 w-5" />,
        vaiTro: TAT_CA,
      },
    ],
  },
]

export function Sidebar({ vaiTro }: { vaiTro: Role }) {
  const duong = usePathname()
  const [mo, setMo] = useState(false)

  const nhom = NHOM.map((n) => ({ ...n, muc: n.muc.filter((m) => m.vaiTro.includes(vaiTro)) })).filter(
    (n) => n.muc.length > 0,
  )

  const dangO = (href: string) => duong === href || duong.startsWith(href + '/')

  const danhSach = (
    <nav className="flex flex-col gap-6">
      {nhom.map((n) => (
        <div key={n.nhan}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {n.nhan}
          </p>
          <ul className="flex flex-col gap-1">
            {n.muc.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  onClick={() => setMo(false)}
                  className={[
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    dangO(m.href)
                      ? 'bg-brand-600 text-white shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span className={dangO(m.href) ? 'text-white' : 'text-slate-400'}>{m.icon}</span>
                  {m.ten}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <>
      {/* Máy tính: cột cố định bên trái */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200/70 bg-white/80 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/" className="mb-7 flex items-center gap-3 px-2">
          <span className="o-icon h-10 w-10 bg-gradient-to-br from-brand-500 to-brand-700">
            <IconDauTich className="h-5 w-5" />
          </span>
          <span className="text-sm font-bold uppercase leading-tight tracking-tight">
            Nhà máy
            <br />
            thông minh EMIC
          </span>
        </Link>
        {danhSach}
      </aside>

      {/* Điện thoại: nút mở menu + lớp phủ trượt ra */}
      <button
        onClick={() => setMo(true)}
        aria-label="Mở menu"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_12px_28px_-8px_rgba(37,99,235,0.9)] lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mo && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMo(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white px-4 py-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-bold uppercase">Nhà máy thông minh EMIC</span>
              <button onClick={() => setMo(false)} aria-label="Đóng" className="nut-phu px-2 py-1">
                ✕
              </button>
            </div>
            {danhSach}
          </div>
        </div>
      )}
    </>
  )
}
