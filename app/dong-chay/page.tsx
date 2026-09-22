import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/Header'
import SoDoDongChay from './SoDoDongChay'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR', 'PLANNER', 'TEAM_LEADER']
const DUOC_SUA = ['ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

export default async function TrangDongChay({
  searchParams,
}: {
  searchParams: Promise<{ sp?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { sp } = await searchParams

  const sanPhams = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, unit: true, isKit: true },
  })
  const sanPham = sanPhams.find((p) => p.id === sp) ?? sanPhams[0] ?? null

  const boPhans = sanPham
    ? await prisma.productSection.findMany({
        where: { productId: sanPham.id, isActive: true },
        orderBy: { seq: 'asc' },
        include: {
          operations: {
            orderBy: { seq: 'asc' },
            include: { _count: { select: { orderOperations: true, seats: true } } },
          },
        },
      })
    : []

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5">
      <Header
        tieuDe="Sơ đồ dòng chảy công nghệ"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`}
        nguoiDung={u}
        them={
          <Link href="/ky-thuat" className="nut-phu">
            Định mức · Phiếu lỗi
          </Link>
        }
      />

      {sanPhams.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {sanPhams.map((p) => (
            <Link
              key={p.id}
              href={`/dong-chay?sp=${p.id}`}
              className={p.id === sanPham?.id ? 'chip-bat' : 'chip-tat'}
            >
              {p.code} · {p.name}
            </Link>
          ))}
        </div>
      )}

      {!sanPham ? (
        <p className="the text-sm text-slate-600">
          Chưa có sản phẩm nào. Chạy <code>npm run db:seed</code> để nạp định mức.
        </p>
      ) : (
        <SoDoDongChay
          duocSua={DUOC_SUA.includes(u.role)}
          sanPham={{ id: sanPham.id, code: sanPham.code, ten: sanPham.name, donVi: sanPham.unit, laBo: sanPham.isKit }}
          boPhans={boPhans.map((s) => ({
            id: s.id,
            code: s.code,
            ten: s.name,
            phuThuocTatCa: s.dependsOnAllSections,
            nguyenCongs: s.operations.map((o) => ({
              id: o.id,
              ma: o.code,
              ten: o.name,
              chiTiet: o.detail,
              giay: o.standardSeconds,
              nguong: o.targetPercent,
              laQC: o.isQC,
              dangDung: o.isActive,
              soLenh: o._count.orderOperations,
              soGhe: o._count.seats,
            })),
          }))}
        />
      )}
    </main>
  )
}
