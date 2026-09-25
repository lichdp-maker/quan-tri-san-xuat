import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import SoDoXuong from './SoDoXuong'

export const dynamic = 'force-dynamic'

export default async function TrangSoDoXuong() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (!coQuyen(u.quyen, 'XEM_MAT_BANG')) redirect('/')

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)

  // Nạp cả từng ghế để vẽ đúng chỗ ngồi trên mặt bằng, không chỉ đếm tổng
  const lines = await prisma.line.findMany({
    where: { isActive: true },
    orderBy: [{ tang: 'desc' }, { viTriY: 'asc' }, { viTriX: 'asc' }],
    include: {
      team: { select: { name: true } },
      currentOrder: { select: { code: true, product: { select: { name: true } } } },
      _count: { select: { operations: true } },
      seats: {
        orderBy: [{ side: 'asc' }, { seq: 'asc' }],
        select: {
          id: true,
          side: true,
          seq: true,
          operationId: true,
          operation: { select: { name: true } },
          assignments: {
            where: { workDate },
            take: 1,
            select: { user: { select: { fullName: true } } },
          },
        },
      },
    },
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ mặt bằng xưởng"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
      />

      <SoDoXuong
        duocSapXep={coQuyen(u.quyen, 'SAP_XEP_MAT_BANG')}
        viTris={lines.map((l) => ({
          id: l.id,
          ma: l.code,
          ten: l.name,
          loai: l.loai,
          tang: l.tang,
          x: l.viTriX,
          y: l.viTriY,
          rong: l.rong,
          soNguyenCong: l._count.operations,
          to: l.team?.name ?? null,
          lenh: l.currentOrder ? `${l.currentOrder.code} · ${l.currentOrder.product.name}` : null,
          ghe: l.seats.map((g) => ({
            id: g.id,
            mat: g.side as 'A' | 'B',
            so: g.seq,
            coNguyenCong: !!g.operationId,
            tenNguyenCong: g.operation?.name ?? null,
            nguoi: g.assignments[0]?.user.fullName ?? null,
          })),
        }))}
      />
    </main>
  )
}
