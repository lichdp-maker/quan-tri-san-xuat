import { redirect } from 'next/navigation'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import { ngayHomNay } from '@/lib/date'
import { cachNgay } from '@/lib/ngay-xep'
import { taoLenh } from './actions'
import LuoiLenh from './LuoiLenh'

export const dynamic = 'force-dynamic'

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
function ymdVN(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
}

export default async function TrangLenhSanXuat() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!coQuyen(u.quyen, 'QUAN_LY_LENH')) redirect('/')

  const [sanPham, lenhs] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.productionOrder.findMany({
      include: {
        product: true,
        operations: { select: { doneQtyOk: true, doneQtyDefect: true } },
        lines: { where: { isActive: true }, select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
  ])

  const homNay = ngayHomNay()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5">
      <Header
        tieuDe="Lệnh sản xuất"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`}
        nguoiDung={u}
      />

      <details className="the mb-5">
        <summary className="cursor-pointer font-semibold">+ Tạo lệnh sản xuất mới</summary>
      <form action={taoLenh} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className="text-sm font-medium text-slate-600">Ghi chú</span>
          <input name="note" className="rounded-lg border-2 border-slate-300 px-3 py-2" />
        </label>

        <div className="sm:col-span-2 lg:col-span-4">
          <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">
            Tạo và phát hành lệnh
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Khi phát hành, hệ thống sinh toàn bộ nguyên công của sản phẩm cho lệnh này và chụp lại
            định mức hiện tại. Sửa định mức về sau không làm đổi cách tính của lệnh đã phát hành.
          </p>
        </div>
      </form>
      </details>

      <LuoiLenh
        lenhs={lenhs.map((l) => {
          // Đã xong = số lượng đã qua hết mọi nguyên công — cùng cách tính với trang xếp nhân sự
          const xong = l.operations.length > 0 ? Math.min(...l.operations.map((o) => o.doneQtyOk)) : 0
          const han = l.dueDate ? ymdVN(l.dueDate) : null
          return {
            id: l.id,
            ma: l.code,
            sanPham: l.product.name,
            maSP: l.product.code,
            soLuong: l.quantity,
            donVi: l.product.unit,
            xong,
            hong: l.operations.reduce((a, o) => a + o.doneQtyDefect, 0),
            soNC: l.operations.length,
            han,
            conNgay: han ? cachNgay(homNay, han) : null,
            trangThai: l.status,
            chuyen: l.lines.map((c) => c.name),
            taoLuc: ymdVN(l.createdAt),
          }
        })}
      />
    </main>
  )
}
