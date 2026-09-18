import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { aggregate, qualityRate } from '@/lib/productivity'
import { Header } from '@/components/Header'
import { Thanh } from './Thanh'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR', 'PLANNER', 'ENGINEER', 'WAREHOUSE']

const KY: Record<string, { nhan: string; soNgay: number }> = {
  'hom-nay': { nhan: 'Hôm nay', soNgay: 1 },
  '7-ngay': { nhan: '7 ngày', soNgay: 7 },
  '30-ngay': { nhan: '30 ngày', soNgay: 30 },
}

export default async function TrangBangDieuKhien({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { ky: kyChon } = await searchParams
  const ky = KY[kyChon ?? ''] ? (kyChon as string) : 'hom-nay'
  const { nhan: nhanKy, soNgay } = KY[ky]

  const ymd = ngayHomNay()
  const denNgay = ngayLamViec(ymd)
  const tuNgay = new Date(denNgay)
  tuNgay.setUTCDate(tuNgay.getUTCDate() - (soNgay - 1))

  const [banGhi, loi, lenhs, choDuyet] = await Promise.all([
    prisma.productionEntry.findMany({
      where: { status: 'APPROVED', workDate: { gte: tuNgay, lte: denNgay } },
      select: {
        qtyOk: true,
        qtyDefect: true,
        earnedSeconds: true,
        netMinutes: true,
        isAchieved: true,
        assignment: {
          select: {
            userId: true,
            teamId: true,
            user: { select: { fullName: true, employeeCode: true } },
            team: { select: { name: true } },
          },
        },
      },
    }),
    prisma.defectRecord.findMany({
      where: { entry: { status: 'APPROVED', workDate: { gte: tuNgay, lte: denNgay } } },
      select: { qty: true, defectType: { select: { name: true, group: true } } },
    }),
    prisma.productionOrder.findMany({
      where: { status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      include: { product: true, operations: { orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }] } },
      orderBy: { priority: 'desc' },
    }),
    prisma.productionEntry.count({ where: { status: 'PENDING' } }),
  ])

  // ----- KPI -----
  const tongDat = banGhi.reduce((a, e) => a + e.qtyOk, 0)
  const tongHong = banGhi.reduce((a, e) => a + e.qtyDefect, 0)
  const tyLeDat = qualityRate(tongDat, tongHong)
  const chung = aggregate(
    banGhi.map((e) => ({ earnedSeconds: e.earnedSeconds ?? 0, netMinutes: e.netMinutes ?? 0 })),
  )

  // ----- Năng suất theo người -----
  type Gop = {
    ten: string
    phu: string
    earnedSeconds: number
    netMinutes: number
    soBanGhi: number
    soDat: number
  }
  const theoNguoi = new Map<string, Gop>()
  const theoTo = new Map<string, Gop>()

  for (const e of banGhi) {
    const a = e.assignment
    const them = (map: Map<string, Gop>, khoa: string, ten: string, phu: string) => {
      const g = map.get(khoa) ?? { ten, phu, earnedSeconds: 0, netMinutes: 0, soBanGhi: 0, soDat: 0 }
      g.earnedSeconds += e.earnedSeconds ?? 0
      g.netMinutes += e.netMinutes ?? 0
      g.soBanGhi += 1
      if (e.isAchieved) g.soDat += 1
      map.set(khoa, g)
    }
    them(theoNguoi, a.userId, a.user.fullName, a.user.employeeCode)
    them(theoTo, a.teamId, a.team.name, 'tổ')
  }

  const xepHang = (map: Map<string, Gop>) =>
    [...map.values()]
      .map((g) => ({
        ...g,
        nangSuat: g.netMinutes > 0 ? Math.round((g.earnedSeconds / 60 / g.netMinutes) * 1000) / 10 : null,
      }))
      .sort((x, y) => (y.nangSuat ?? -1) - (x.nangSuat ?? -1))

  const bangNguoi = xepHang(theoNguoi)
  const bangTo = xepHang(theoTo)
  const nsCaoNhat = Math.max(100, ...bangNguoi.map((n) => n.nangSuat ?? 0))

  // ----- Pareto sai hỏng -----
  const gopLoi = new Map<string, { ten: string; nhom: string; sl: number }>()
  for (const d of loi) {
    const k = d.defectType.name
    const g = gopLoi.get(k) ?? { ten: k, nhom: d.defectType.group, sl: 0 }
    g.sl += d.qty
    gopLoi.set(k, g)
  }
  const pareto = [...gopLoi.values()].sort((a, b) => b.sl - a.sl)
  const tongLoi = pareto.reduce((a, x) => a + x.sl, 0)
  const loiLonNhat = pareto[0]?.sl ?? 1

  // ----- Tiến độ và cảnh báo trễ hạn -----
  const homNay = new Date(`${ymd}T00:00:00.000Z`)
  const tienDo = lenhs.map((l) => {
    const cuoi = l.operations.at(-1)
    const xong = cuoi?.doneQtyOk ?? 0
    const conLai = Math.max(0, l.quantity - xong)
    const soNgayChay = l.releasedAt
      ? Math.max(1, Math.round((homNay.getTime() - l.releasedAt.getTime()) / 86400000))
      : 1
    const tocDo = xong / soNgayChay
    const ngayCan = tocDo > 0 ? Math.ceil(conLai / tocDo) : null
    const ngayConLai = l.dueDate
      ? Math.round((l.dueDate.getTime() - homNay.getTime()) / 86400000)
      : null

    let canhBao: string | null = null
    if (l.dueDate && conLai > 0) {
      if (ngayConLai !== null && ngayConLai < 0) canhBao = 'Đã quá hạn giao'
      else if (ngayCan === null) canhBao = 'Chưa có sản lượng, không ước tính được'
      else if (ngayConLai !== null && ngayCan > ngayConLai)
        canhBao = `Theo tốc độ hiện tại cần thêm ${ngayCan} ngày, chỉ còn ${ngayConLai} ngày`
    }

    return {
      id: l.id,
      code: l.code,
      sanPham: l.product.name,
      quantity: l.quantity,
      xong,
      pct: l.quantity > 0 ? Math.round((xong / l.quantity) * 100) : 0,
      tocDo: Math.round(tocDo * 10) / 10,
      canhBao,
      hong: l.operations.reduce((a, o) => a + o.doneQtyDefect, 0),
    }
  })

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5">
      <Header
        tieuDe="Bảng tổng hợp sản xuất"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
      />

      {/* Xuất dữ liệu ra Excel */}
      <form action="/bao-cao/xuat" method="get" className="the mb-5 flex flex-wrap items-end gap-2">
        <span className="text-sm font-medium text-slate-600">Xuất số liệu ra Excel</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Từ ngày</span>
          <input type="date" name="tu" defaultValue={ymd} className="rounded-lg border-2 border-slate-300 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Đến ngày</span>
          <input type="date" name="den" defaultValue={ymd} className="rounded-lg border-2 border-slate-300 px-2 py-1" />
        </label>
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          Tải file CSV
        </button>
      </form>

      {/* Bộ lọc kỳ — một hàng phía trên toàn bộ số liệu */}
      <div className="mb-5 flex gap-2">
        {Object.entries(KY).map(([k, v]) => (
          <Link
            key={k}
            href={`/bang-dieu-khien?ky=${k}`}
            className={k === ky ? 'chip-bat' : 'chip-tat'}
          >
            {v.nhan}
          </Link>
        ))}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <O nhan={`Sản phẩm đạt · ${nhanKy}`} so={tongDat.toLocaleString('vi-VN')} />
        <O
          nhan="Tỷ lệ đạt chất lượng"
          so={tyLeDat === null ? '—' : `${tyLeDat}%`}
          phu={tongHong > 0 ? `${tongHong} hỏng` : 'không có hỏng'}
        />
        <O
          nhan="Năng suất chung"
          so={chung.performance === null ? '—' : `${chung.performance}%`}
          phu={`${Math.round(chung.netMinutes / 60)} giờ công`}
        />
        <O nhan="Bản ghi chờ duyệt" so={String(choDuyet)} phu={choDuyet > 0 ? 'cần tổ trưởng xử lý' : 'đã duyệt hết'} />
      </section>

      {/* Năng suất theo người */}
      <section className="mb-6">
        <h2 className="mb-1 font-semibold">Năng suất theo người · {nhanKy}</h2>
        <p className="mb-3 text-xs text-slate-500">
          Xếp theo năng suất chung của kỳ. Đạt / chưa đạt được chấm theo từng nguyên công, cột bên
          phải là số lần đạt trên tổng số lần nhập.
        </p>
        {bangNguoi.length === 0 ? (
          <p className="the text-sm text-slate-500">Chưa có bản ghi nào được duyệt trong kỳ này.</p>
        ) : (
          <div className="the overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Người</th>
                  <th className="pb-2 font-medium">Năng suất</th>
                  <th className="pb-2 text-right font-medium">Giờ công</th>
                  <th className="pb-2 text-right font-medium">Đạt / lần nhập</th>
                </tr>
              </thead>
              <tbody>
                {bangNguoi.map((n) => (
                  <tr key={n.phu} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{n.ten}</span>
                      <span className="ml-2 text-xs text-slate-500">{n.phu}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Thanh
                        giaTri={n.nangSuat ?? 0}
                        toiDa={nsCaoNhat}
                        nhan={n.nangSuat === null ? '—' : `${n.nangSuat}%`}
                        dat={(n.nangSuat ?? 0) > 100}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                      {Math.round(n.netMinutes / 60)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-600">
                      {n.soDat}/{n.soBanGhi}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Năng suất theo tổ */}
      {bangTo.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-semibold">Năng suất theo tổ · {nhanKy}</h2>
          <div className="the flex flex-col gap-3">
            {bangTo.map((t) => (
              <div key={t.ten} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium">{t.ten}</span>
                <div className="flex-1">
                  <Thanh
                    giaTri={t.nangSuat ?? 0}
                    toiDa={nsCaoNhat}
                    nhan={t.nangSuat === null ? '—' : `${t.nangSuat}%`}
                    dat={(t.nangSuat ?? 0) > 100}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-xs text-slate-500">
                  {t.soDat}/{t.soBanGhi} lần đạt
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tiến độ lệnh */}
      <section className="mb-6">
        <h2 className="mb-3 font-semibold">Lệnh đang chạy</h2>
        {tienDo.length === 0 ? (
          <p className="the text-sm text-slate-500">Chưa có lệnh nào được phát hành.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tienDo.map((l) => (
              <div key={l.id} className="the">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {l.code} · {l.sanPham}
                  </p>
                  <p className="text-sm tabular-nums text-slate-600">
                    {l.xong}/{l.quantity} ({l.pct}%) · {l.tocDo} sp/ngày
                    {l.hong > 0 && ` · ${l.hong} hỏng`}
                  </p>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded bg-slate-200">
                  <div
                    className="h-full rounded bg-[#2a78d6]"
                    style={{ width: `${Math.min(100, l.pct)}%` }}
                  />
                </div>
                {l.canhBao && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-[#d03b3b]">
                    <span aria-hidden>▲</span>
                    <span>
                      <span className="font-medium">Nguy cơ trễ hạn:</span> {l.canhBao}
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pareto sai hỏng */}
      <section>
        <h2 className="mb-1 font-semibold">Sai hỏng theo loại lỗi · {nhanKy}</h2>
        <p className="mb-3 text-xs text-slate-500">
          Xếp từ nhiều đến ít. Tổng {tongLoi} sản phẩm hỏng.
        </p>
        {pareto.length === 0 ? (
          <p className="the text-sm text-slate-500">Không có sản phẩm hỏng nào trong kỳ này.</p>
        ) : (
          <div className="the flex flex-col gap-2.5">
            {pareto.map((p) => {
              const pct = tongLoi > 0 ? Math.round((p.sl / tongLoi) * 100) : 0
              return (
                <div key={p.ten} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm">
                    {p.ten}
                    <span className="block text-xs text-slate-500">{p.nhom}</span>
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-full">
                      <div
                        className="h-full rounded bg-[#2a78d6]"
                        style={{ width: `${Math.max(2, (p.sl / loiLonNhat) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums text-slate-700">
                    {p.sl} <span className="text-xs text-slate-500">({pct}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function O({ nhan, so, phu }: { nhan: string; so: string; phu?: string }) {
  return (
    <div className="the">
      <p className="text-2xl font-bold leading-tight">{so}</p>
      <p className="mt-0.5 text-xs text-slate-500">{nhan}</p>
      {phu && <p className="text-xs text-slate-400">{phu}</p>}
    </div>
  )
}
