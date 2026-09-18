import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dangXuat } from '../dang-nhap/actions'
import { taoLenh, doiTrangThai } from './actions'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['PLANNER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

const TEN_TRANG_THAI: Record<string, string> = {
  DRAFT: 'Nháp',
  RELEASED: 'Đã phát hành',
  IN_PROGRESS: 'Đang chạy',
  COMPLETED: 'Đã xong',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
}

export default async function TrangLenhSanXuat() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const [sanPham, lenhs] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.productionOrder.findMany({
      include: {
        product: true,
        operations: { orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Lệnh sản xuất</h1>
          <p className="text-sm text-slate-500">
            {u.fullName} · {TEN_VAI_TRO[u.role]}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/bang-dieu-khien"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            Bảng điều khiển
          </Link>
          <form action={dangXuat}>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
              Thoát
            </button>
          </form>
        </div>
      </header>

      <form action={taoLenh} className="the mb-6 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Số lệnh</span>
          <input
            name="code"
            required
            className="rounded-lg border-2 border-slate-300 px-3 py-2 uppercase"
            placeholder="LSX-2026-001"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Sản phẩm</span>
          <select name="productId" required className="rounded-lg border-2 border-slate-300 px-3 py-2">
            {sanPham.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Số lượng</span>
          <input
            name="quantity"
            inputMode="numeric"
            required
            className="rounded-lg border-2 border-slate-300 px-3 py-2"
            placeholder="200"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Hạn giao (không bắt buộc)</span>
          <input name="dueDate" type="date" className="rounded-lg border-2 border-slate-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-600">Ghi chú</span>
          <input name="note" className="rounded-lg border-2 border-slate-300 px-3 py-2" />
        </label>

        <div className="sm:col-span-2">
          <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">
            Tạo và phát hành lệnh
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Khi phát hành, hệ thống sinh toàn bộ nguyên công của sản phẩm cho lệnh này và chụp lại
            định mức hiện tại. Sửa định mức về sau không làm đổi cách tính của lệnh đã phát hành.
          </p>
        </div>
      </form>

      <h2 className="mb-2 font-semibold">Danh sách lệnh</h2>
      <div className="flex flex-col gap-2">
        {lenhs.map((l) => {
          const cuoi = l.operations.at(-1)
          const xong = cuoi?.doneQtyOk ?? 0
          const hong = l.operations.reduce((a, o) => a + o.doneQtyDefect, 0)
          const pct = l.quantity > 0 ? Math.round((xong / l.quantity) * 100) : 0
          return (
            <div key={l.id} className="the">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {l.code} · {l.product.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {TEN_TRANG_THAI[l.status]} · {l.operations.length} nguyên công
                    {hong > 0 && ` · ${hong} hỏng`}
                    {l.dueDate && ` · hạn ${l.dueDate.toLocaleDateString('vi-VN')}`}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-slate-600">
                  {xong}/{l.quantity} ({pct}%)
                </p>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>

              {['RELEASED', 'IN_PROGRESS'].includes(l.status) && (
                <form action={doiTrangThai} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="status" className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                    <option value="IN_PROGRESS">Đang chạy</option>
                    <option value="COMPLETED">Đã xong</option>
                    <option value="CLOSED">Đóng lệnh</option>
                    <option value="CANCELLED">Huỷ lệnh</option>
                  </select>
                  <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600">
                    Cập nhật
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
