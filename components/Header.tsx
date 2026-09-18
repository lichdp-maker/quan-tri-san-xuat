import Link from 'next/link'
import { TEN_VAI_TRO, type NguoiDung } from '@/lib/session'
import { dangXuat } from '@/app/dang-nhap/actions'
import { IconThoat, IconDauTich } from './Icons'

/** Thanh tiêu đề dùng chung cho mọi trang sau khi đăng nhập. */
export function Header({
  tieuDe,
  phu,
  nguoiDung,
  hienTrangChu = true,
  them,
}: {
  tieuDe: string
  phu?: string
  nguoiDung: NguoiDung
  hienTrangChu?: boolean
  them?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {hienTrangChu && (
          <Link
            href="/"
            aria-label="Trang chủ"
            className="o-icon bg-gradient-to-br from-brand-500 to-brand-700"
          >
            <IconDauTich />
          </Link>
        )}
        <div>
          <h1 className="text-lg font-bold leading-tight">{tieuDe}</h1>
          <p className="text-sm text-slate-500">
            {phu ?? `${nguoiDung.fullName} · ${TEN_VAI_TRO[nguoiDung.role]}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {them}
        <form action={dangXuat}>
          <button className="nut-phu flex items-center gap-1.5">
            <IconThoat />
            Thoát
          </button>
        </form>
      </div>
    </header>
  )
}
