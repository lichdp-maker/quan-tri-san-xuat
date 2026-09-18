import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/Header'
import { suaDinhMuc, themNguyenCong, themSanPham, themBoPhan, xuLyPhieuLoi } from './actions'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']

const HUONG_XU_LY: Record<string, string> = {
  PENDING: 'Chưa quyết',
  REWORK: 'Sửa lại',
  SCRAP: 'Phế bỏ',
  USE_AS_IS: 'Dùng nguyên trạng',
  RETURN_SUPPLIER: 'Trả nhà cung cấp',
}

export default async function TrangKyThuat({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sp?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { tab, sp } = await searchParams
  const tabHienTai = tab === 'phieu-loi' ? 'phieu-loi' : 'dinh-muc'

  const sanPham = await prisma.product.findMany({ orderBy: { code: 'asc' } })
  const spHienTai = sanPham.find((p) => p.id === sp) ?? sanPham[0] ?? null

  const boPhan = spHienTai
    ? await prisma.productSection.findMany({
        where: { productId: spHienTai.id },
        orderBy: { seq: 'asc' },
        include: { operations: { orderBy: { seq: 'asc' } } },
      })
    : []

  const [phieuLoi, nguyenNhan] = await Promise.all([
    tabHienTai === 'phieu-loi'
      ? prisma.defectRecord.findMany({
          where: { disposition: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            defectType: true,
            entry: {
              include: {
                assignment: {
                  include: {
                    user: true,
                    orderOperation: { include: { operation: true, order: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.defectCause.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }),
  ])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5">
      <Header
        tieuDe="Kỹ thuật"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`}
        nguoiDung={u}
      />

      <div className="mb-5 flex gap-2">
        <Link
          href="/ky-thuat?tab=dinh-muc"
          className={tabLop(tabHienTai === 'dinh-muc')}
        >
          Định mức nguyên công
        </Link>
        <Link href="/ky-thuat?tab=phieu-loi" className={tabLop(tabHienTai === 'phieu-loi')}>
          Phiếu lỗi chờ xử lý
        </Link>
      </div>

      {tabHienTai === 'dinh-muc' ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {sanPham.map((p) => (
              <Link
                key={p.id}
                href={`/ky-thuat?tab=dinh-muc&sp=${p.id}`}
                className={p.id === spHienTai?.id ? 'chip-bat' : 'chip-tat'}
              >
                {p.code}
              </Link>
            ))}
          </div>

          <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Sửa định mức ở đây <strong>không làm đổi</strong> các lệnh đang chạy — mỗi lệnh đã chụp
            lại định mức lúc phát hành. Thay đổi chỉ áp dụng cho lệnh phát hành sau này.
          </p>

          {boPhan.map((s) => {
            const tong = s.operations.filter((o) => o.isActive).reduce((a, o) => a + o.standardSeconds, 0)
            return (
              <section key={s.id} className="mb-6">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold">
                    {s.name}
                    {s.dependsOnAllSections && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        (chốt sau các bộ phận khác)
                      </span>
                    )}
                  </h2>
                  <p className="text-sm tabular-nums text-slate-600">
                    {s.operations.filter((o) => o.isActive).length} nguyên công · {tong}s ={' '}
                    {Math.round((tong / 60) * 100) / 100} phút
                  </p>
                </div>

                <div className="the overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 font-medium">Nguyên công</th>
                        <th className="pb-2 font-medium">Định mức (giây)</th>
                        <th className="pb-2 font-medium">Ngưỡng đạt (%)</th>
                        <th className="pb-2 font-medium">Còn dùng</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {s.operations.map((o) => (
                        <tr key={o.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-3">
                            <span className={o.isActive ? 'font-medium' : 'text-slate-400 line-through'}>
                              {o.name}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">{o.code}</span>
                            {o.isQC && (
                              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                QC
                              </span>
                            )}
                            {o.note && <span className="block text-xs text-slate-500">{o.note}</span>}
                          </td>
                          <td className="py-2 pr-3" colSpan={4}>
                            <form action={suaDinhMuc} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={o.id} />
                              <input
                                name="standardSeconds"
                                inputMode="numeric"
                                defaultValue={o.standardSeconds}
                                className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1 text-center tabular-nums"
                              />
                              <input
                                name="targetPercent"
                                inputMode="numeric"
                                defaultValue={o.targetPercent}
                                className="w-16 rounded-lg border-2 border-slate-300 px-2 py-1 text-center tabular-nums"
                              />
                              <label className="flex items-center gap-1 text-xs text-slate-600">
                                <input type="checkbox" name="isActive" defaultChecked={o.isActive} />
                                còn dùng
                              </label>
                              <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700">
                                Lưu
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <form action={themNguyenCong} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
                    <input type="hidden" name="sectionId" value={s.id} />
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-xs text-slate-600">Thêm nguyên công</span>
                      <input
                        name="name"
                        required
                        placeholder="Tên nguyên công"
                        className="rounded-lg border-2 border-slate-300 px-3 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600">Giây</span>
                      <input
                        name="standardSeconds"
                        inputMode="numeric"
                        required
                        className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center"
                      />
                    </label>
                    <label className="mb-2 flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" name="isQC" /> là bước QC
                    </label>
                    <button className="mb-0.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
                      Thêm
                    </button>
                  </form>
                </div>
              </section>
            )
          })}

          <section className="grid gap-4 sm:grid-cols-2">
            {spHienTai && (
              <form action={themBoPhan} className="the flex flex-col gap-2">
                <p className="font-medium">Thêm bộ phận cho {spHienTai.code}</p>
                <input type="hidden" name="productId" value={spHienTai.id} />
                <input name="code" required placeholder="Mã (HD, BG...)" className="rounded-lg border-2 border-slate-300 px-3 py-1.5 uppercase" />
                <input name="name" required placeholder="Tên bộ phận" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="dependsOnAllSections" /> là bước bao gói, chốt sau cùng
                </label>
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Thêm bộ phận</button>
              </form>
            )}

            <form action={themSanPham} className="the flex flex-col gap-2">
              <p className="font-medium">Thêm sản phẩm mới</p>
              <input name="code" required placeholder="Mã sản phẩm" className="rounded-lg border-2 border-slate-300 px-3 py-1.5 uppercase" />
              <input name="name" required placeholder="Tên sản phẩm" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
              <input name="unit" placeholder="Đơn vị (sp / bộ)" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="isKit" /> là bộ gồm nhiều bộ phận
              </label>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Thêm sản phẩm</button>
            </form>
          </section>
        </>
      ) : (
        <section>
          <p className="mb-3 text-sm text-slate-500">
            {phieuLoi.length === 0
              ? 'Không còn phiếu lỗi nào chờ xử lý.'
              : `${phieuLoi.length} phiếu chờ xác định nguyên nhân và hướng xử lý.`}
          </p>

          <div className="flex flex-col gap-2">
            {phieuLoi.map((d) => {
              const a = d.entry.assignment
              return (
                <div key={d.id} className="the">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {d.defectType.name}
                      <span className="ml-2 text-sm font-normal text-slate-600">
                        {d.qty} sản phẩm
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.user.fullName} · {a.orderOperation.operation.name} · lệnh{' '}
                      {a.orderOperation.order.code} ·{' '}
                      {d.entry.workDate.toLocaleDateString('vi-VN', { timeZone: 'UTC' })}
                    </p>
                  </div>

                  <form action={xuLyPhieuLoi} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-xs text-slate-600">Nguyên nhân</span>
                      <select name="causeId" className="rounded-lg border-2 border-slate-300 px-2 py-1.5">
                        <option value="">— chưa xác định —</option>
                        {nguyenNhan.map((n) => (
                          <option key={n.id} value={n.id}>
                            [{n.category}] {n.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600">Hướng xử lý</span>
                      <select name="disposition" className="rounded-lg border-2 border-slate-300 px-2 py-1.5">
                        {Object.entries(HUONG_XU_LY).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-xs text-slate-600">Ghi chú</span>
                      <input name="engineerNote" className="rounded-lg border-2 border-slate-300 px-2 py-1.5" />
                    </label>
                    <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
                      Lưu
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

function tabLop(dangChon: boolean): string {
  return dangChon ? 'chip-bat' : 'chip-tat'
}
