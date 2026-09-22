import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { Header } from '@/components/Header'
import SoDoXuong from './SoDoXuong'

export const dynamic = 'force-dynamic'

const DUOC_VAO = [
  'TEAM_LEADER',
  'ENGINEER',
  'PLANNER',
  'WAREHOUSE',
  'SHOP_MANAGER',
  'DEPUTY_DIRECTOR',
  'DIRECTOR',
]
const DUOC_SAP_XEP = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

export default async function TrangSoDoXuong() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  const [lines, xepHomNay] = await Promise.all([
    prisma.line.findMany({
      where: { isActive: true },
      orderBy: [{ tang: 'desc' }, { viTriY: 'asc' }, { viTriX: 'asc' }],
      include: {
        team: { select: { name: true } },
        currentOrder: { select: { code: true, product: { select: { name: true } } } },
        _count: { select: { seats: true, operations: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { workDate, seatId: { not: null } },
      select: { seat: { select: { lineId: true } } },
    }),
  ])

  const demNguoi = new Map<string, number>()
  for (const x of xepHomNay) {
    const id = x.seat!.lineId
    demNguoi.set(id, (demNguoi.get(id) ?? 0) + 1)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ mặt bằng xưởng"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
      />

      <SoDoXuong
        duocSapXep={DUOC_SAP_XEP.includes(u.role)}
        viTris={lines.map((l) => ({
          id: l.id,
          ma: l.code,
          ten: l.name,
          loai: l.loai,
          tang: l.tang,
          x: l.viTriX,
          y: l.viTriY,
          rong: l.rong,
          cao: l.cao,
          soGhe: l._count.seats,
          soNguyenCong: l._count.operations,
          daXep: demNguoi.get(l.id) ?? 0,
          to: l.team?.name ?? null,
          lenh: l.currentOrder ? `${l.currentOrder.code} · ${l.currentOrder.product.name}` : null,
        }))}
      />
    </main>
  )
}
