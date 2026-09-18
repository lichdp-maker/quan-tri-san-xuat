import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { taoPhanCong, xoaPhanCong } from '../actions'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['TEAM_LEADER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

export default async function TrangPhanCong({
  searchParams,
}: {
  searchParams: Promise<{ lenh?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { lenh: lenhChon } = await searchParams
  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)
  const locTo = u.role === 'TEAM_LEADER' ? { teamId: u.teamId ?? '' } : {}

  const [lenhs, congNhan, cas, daGan] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      include: { product: true },
      orderBy: { priority: 'desc' },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: 'WORKER', ...locTo },
      orderBy: { employeeCode: 'asc' },
    }),
    prisma.shift.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.assignment.findMany({
      where: { workDate, ...locTo },
      include: {
        user: true,
        orderOperation: { include: { operation: true, order: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ user: { employeeCode: 'asc' } }],
    }),
  ])

  const lenhHienTai = lenhs.find((l) => l.id === lenhChon) ?? lenhs[0] ?? null

  const nguyenCongs = lenhHienTai
    ? await prisma.orderOperation.findMany({
        where: { orderId: lenhHienTai.id },
        include: { operation: { include: { section: true } } },
        orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }],
      })
    : []

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Phân công</h1>
          <p className="text-sm text-slate-500">Ngày {dinhDangNgay(ymd)}</p>
        </div>
        <Link
          href="/to-truong"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
        >
          Quay lại
        </Link>
      </header>

      {lenhs.length === 0 ? (
        <p className="the text-sm text-slate-500">
          Chưa có lệnh sản xuất nào được phát hành. Nhân viên kinh tế tạo lệnh ở mục{' '}
          <Link href="/lenh-san-xuat" className="text-brand-600 underline">
            Lệnh sản xuất
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {lenhs.map((l) => (
              <Link
                key={l.id}
                href={`/to-truong/phan-cong?lenh=${l.id}`}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium',
                  l.id === lenhHienTai?.id
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700',
                ].join(' ')}
              >
                {l.code} · {l.product.code} · {l.quantity}
              </Link>
            ))}
          </div>

          <form action={taoPhanCong} className="the mb-6 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">Nguyên công</span>
              <select name="orderOperationId" required className="rounded-lg border-2 border-slate-300 px-3 py-2">
                {nguyenCongs.map((oo) => (
                  <option key={oo.id} value={oo.id}>
                    [{oo.operation.section.name}] {oo.operation.name} — định mức{' '}
                    {oo.standardSeconds}s — còn {oo.targetQty - oo.doneQtyOk}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600">Công nhân</span>
              <select name="userId" required className="rounded-lg border-2 border-slate-300 px-3 py-2">
                {congNhan.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.employeeCode} — {c.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600">Ca</span>
              <select name="shiftId" required className="rounded-lg border-2 border-slate-300 px-3 py-2">
                {cas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.startTime}–{c.endTime})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600">
                Chỉ tiêu ca (không bắt buộc)
              </span>
              <input
                name="targetQty"
                inputMode="numeric"
                className="rounded-lg border-2 border-slate-300 px-3 py-2"
                placeholder="để trống nếu đánh giá theo định mức"
              />
            </label>

            <div className="flex items-end">
              <button className="w-full rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">
                Gán việc
              </button>
            </div>
          </form>
        </>
      )}

      <h2 className="mb-2 font-semibold">Đã phân công hôm nay ({daGan.length})</h2>
      {daGan.length === 0 ? (
        <p className="the text-sm text-slate-500">Chưa gán việc cho ai.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {daGan.map((a) => (
            <div key={a.id} className="the flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium leading-tight">
                  {a.user.employeeCode} — {a.user.fullName}
                </p>
                <p className="text-xs text-slate-500">
                  {a.orderOperation.operation.name} · lệnh {a.orderOperation.order.code}
                  {a.targetQty ? ` · chỉ tiêu ${a.targetQty}` : ''}
                </p>
              </div>
              {a._count.entries === 0 ? (
                <form action={xoaPhanCong}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
                    Gỡ
                  </button>
                </form>
              ) : (
                <span className="text-xs text-slate-400">đã có {a._count.entries} bản ghi</span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
