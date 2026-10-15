import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import DanhSachYKien from './DanhSachYKien'

export const dynamic = 'force-dynamic'

const LOC_TRANG_THAI = [
  { ma: 'can-xu-ly', ten: 'Cần xử lý' },
  { ma: 'da-xu-ly', ten: 'Đã xử lý' },
  { ma: 'tat-ca', ten: 'Tất cả' },
] as const

const LOC_LOAI = [
  { ma: '', ten: 'Mọi loại' },
  { ma: 'VUONG_MAC', ten: 'Vướng mắc' },
  { ma: 'CAI_TIEN', ten: 'Cải tiến' },
] as const

export default async function TrangYKien({
  searchParams,
}: {
  searchParams: Promise<{ tt?: string; loai?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!coQuyen(u.quyen, 'XU_LY_Y_KIEN')) redirect('/')

  const sp = await searchParams
  const tt = LOC_TRANG_THAI.some((x) => x.ma === sp.tt) ? sp.tt! : 'can-xu-ly'
  const loai = sp.loai === 'VUONG_MAC' || sp.loai === 'CAI_TIEN' ? sp.loai : ''

  // Tổ trưởng: ý kiến của người trong tổ, hoặc phát sinh trên chuyền của tổ
  const phamVi: Prisma.YKienWhereInput =
    u.role === 'TEAM_LEADER'
      ? { OR: [{ user: { teamId: u.teamId ?? '__khong__' } }, { line: { teamId: u.teamId ?? '__khong__' } }] }
      : {}

  const locTT: Prisma.YKienWhereInput =
    tt === 'can-xu-ly'
      ? { trangThai: { in: ['MOI', 'DANG_XU_LY'] } }
      : tt === 'da-xu-ly'
        ? { trangThai: 'DA_XU_LY' }
        : {}

  const [ds, demMoi, demDang] = await Promise.all([
    prisma.yKien.findMany({
      where: { ...phamVi, ...locTT, ...(loai ? { loai } : {}) },
      include: {
        user: { select: { fullName: true, employeeCode: true, team: { select: { name: true } } } },
        line: { select: { name: true } },
        operation: { select: { code: true, name: true } },
        xuLyBoi: { select: { fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    }),
    prisma.yKien.count({ where: { ...phamVi, trangThai: 'MOI' } }),
    prisma.yKien.count({ where: { ...phamVi, trangThai: 'DANG_XU_LY' } }),
  ])

  const href = (moi: { tt?: string; loai?: string }) => {
    const q = new URLSearchParams()
    const t = moi.tt ?? tt
    const l = moi.loai ?? loai
    if (t !== 'can-xu-ly') q.set('tt', t)
    if (l) q.set('loai', l)
    const s = q.toString()
    return s ? `/y-kien?${s}` : '/y-kien'
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">
      <Header
        tieuDe="Vướng mắc · Đề xuất"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`}
        nguoiDung={u}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="the py-3">
          <div className="nhan">Chưa xem</div>
          <div className={`text-2xl font-bold tabular-nums ${demMoi > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {demMoi}
          </div>
        </div>
        <div className="the py-3">
          <div className="nhan">Đang xử lý</div>
          <div className="text-2xl font-bold tabular-nums text-amber-600">{demDang}</div>
        </div>
      </div>

      <nav aria-label="Lọc trạng thái" className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {LOC_TRANG_THAI.map((x) => (
          <Link
            key={x.ma}
            href={href({ tt: x.ma })}
            className={`${tt === x.ma ? 'chip-bat' : 'chip-tat'} inline-flex min-h-11 shrink-0 items-center`}
            aria-current={tt === x.ma ? 'page' : undefined}
          >
            {x.ten}
          </Link>
        ))}
      </nav>
      <nav aria-label="Lọc loại" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {LOC_LOAI.map((x) => (
          <Link
            key={x.ma || 'tat-ca'}
            href={href({ loai: x.ma })}
            className={`${loai === x.ma ? 'chip-bat' : 'chip-tat'} inline-flex min-h-11 shrink-0 items-center`}
            aria-current={loai === x.ma ? 'page' : undefined}
          >
            {x.ten}
          </Link>
        ))}
      </nav>

      <DanhSachYKien
        ds={ds.map((y) => ({
          id: y.id,
          loai: y.loai,
          noiDung: y.noiDung,
          trangThai: y.trangThai,
          phanHoi: y.phanHoi,
          luc: y.createdAt.toISOString(),
          nguoi: `${y.user.fullName} · ${y.user.employeeCode}`,
          to: y.user.team?.name ?? null,
          noi: [y.line?.name, y.operation ? `${y.operation.code} ${y.operation.name}` : null]
            .filter(Boolean)
            .join(' · '),
          xuLyBoi: y.xuLyBoi?.fullName ?? null,
          xuLyLuc: y.xuLyLuc?.toISOString() ?? null,
        }))}
      />
    </main>
  )
}
