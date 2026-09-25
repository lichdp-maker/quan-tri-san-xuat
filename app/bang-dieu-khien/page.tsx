import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, dinhDangNgay } from '@/lib/date'
import { aggregate, qualityRate } from '@/lib/productivity'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import {
  CotSanLuong,
  VongChatLuong,
  DongHoNangSuat,
  XepHangNgang,
  ParetoLoi,
  KhongCo,
  type DiemSL,
  type MucThanh,
} from './Bieu'

export const dynamic = 'force-dynamic'


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
  if (u.phaiDoiMatKhau) redirect('/doi-mat-khau')
  if (!coQuyen(u.quyen, 'XEM_TONG_HOP')) redirect('/')

  const { ky: kyChon } = await searchParams
  const ky = KY[kyChon ?? ''] ? (kyChon as string) : 'hom-nay'
  const { nhan: nhanKy, soNgay } = KY[ky]

  const ymd = ngayHomNay()
  const denNgay = ngayLamViec(ymd)
  const tuNgay = new Date(denNgay)
  tuNgay.setUTCDate(tuNgay.getUTCDate() - (soNgay - 1))

  // Kỳ liền trước, cùng độ dài — để so sánh tăng/giảm
  const truocDen = new Date(tuNgay)
  truocDen.setUTCDate(truocDen.getUTCDate() - 1)
  const truocTu = new Date(truocDen)
  truocTu.setUTCDate(truocTu.getUTCDate() - (soNgay - 1))

  const [banGhi, kyTruoc, loi, lenhs, choDuyet] = await Promise.all([
    prisma.productionEntry.findMany({
      where: { status: 'APPROVED', workDate: { gte: tuNgay, lte: denNgay } },
      select: {
        qtyOk: true,
        qtyDefect: true,
        earnedSeconds: true,
        netMinutes: true,
        isAchieved: true,
        workDate: true,
        timeSlot: { select: { seq: true, label: true } },
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
    prisma.productionEntry.findMany({
      where: { status: 'APPROVED', workDate: { gte: truocTu, lte: truocDen } },
      select: { qtyOk: true, qtyDefect: true, earnedSeconds: true, netMinutes: true },
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

  const truocDat = kyTruoc.reduce((a, e) => a + e.qtyOk, 0)
  const truocHong = kyTruoc.reduce((a, e) => a + e.qtyDefect, 0)
  const truocTyLe = qualityRate(truocDat, truocHong)
  const truocChung = aggregate(
    kyTruoc.map((e) => ({ earnedSeconds: e.earnedSeconds ?? 0, netMinutes: e.netMinutes ?? 0 })),
  )

  /** Chênh lệch so với kỳ trước, đã viết sẵn thành chữ. */
  function lech(nay: number | null, truoc: number | null, donVi: '%' | 'sp'): string | null {
    if (nay === null || truoc === null || truoc === 0) return null
    const d = donVi === '%' ? nay - truoc : ((nay - truoc) / truoc) * 100
    if (Math.abs(d) < 0.05) return 'không đổi so với kỳ trước'
    const dau = d > 0 ? '▲' : '▼'
    const so = Math.abs(Math.round(d * 10) / 10)
    return `${dau} ${so}${donVi === '%' ? ' điểm' : '%'} so với kỳ trước`
  }

  // ----- Diễn biến theo thời gian -----
  const thung = new Map<string, { nhan: string; thuTu: number; dat: number; hong: number; giay: number; phut: number }>()
  for (const e of banGhi) {
    const theoMoc = soNgay === 1
    const khoa = theoMoc ? String(e.timeSlot.seq) : e.workDate.toISOString().slice(0, 10)
    const nhan = theoMoc
      ? e.timeSlot.label
      : `${e.workDate.getUTCDate()}/${e.workDate.getUTCMonth() + 1}`
    const thuTu = theoMoc ? e.timeSlot.seq : e.workDate.getTime()
    const t = thung.get(khoa) ?? { nhan, thuTu, dat: 0, hong: 0, giay: 0, phut: 0 }
    t.dat += e.qtyOk
    t.hong += e.qtyDefect
    t.giay += e.earnedSeconds ?? 0
    t.phut += e.netMinutes ?? 0
    thung.set(khoa, t)
  }
  const dienBien: DiemSL[] = [...thung.values()]
    .sort((a, b) => a.thuTu - b.thuTu)
    .map((t) => ({
      nhan: t.nhan,
      dat: t.dat,
      hong: t.hong,
      ns: t.phut > 0 ? Math.round((t.giay / 60 / t.phut) * 1000) / 10 : null,
    }))

  // ----- Năng suất theo người / theo tổ -----
  type Gop = { ten: string; phu: string; giay: number; phut: number; soBanGhi: number; soDat: number }
  const theoNguoi = new Map<string, Gop>()
  const theoTo = new Map<string, Gop>()

  for (const e of banGhi) {
    const a = e.assignment
    const them = (map: Map<string, Gop>, khoa: string, ten: string, phu: string) => {
      const g = map.get(khoa) ?? { ten, phu, giay: 0, phut: 0, soBanGhi: 0, soDat: 0 }
      g.giay += e.earnedSeconds ?? 0
      g.phut += e.netMinutes ?? 0
      g.soBanGhi += 1
      if (e.isAchieved) g.soDat += 1
      map.set(khoa, g)
    }
    them(theoNguoi, a.userId, a.user.fullName, a.user.employeeCode)
    them(theoTo, a.teamId, a.team.name, 'tổ')
  }

  const xepHang = (map: Map<string, Gop>) =>
    [...map.entries()]
      .map(([khoa, g]) => ({
        khoa,
        ...g,
        nangSuat: g.phut > 0 ? Math.round((g.giay / 60 / g.phut) * 1000) / 10 : null,
      }))
      .sort((x, y) => (y.nangSuat ?? -1) - (x.nangSuat ?? -1))

  const bangNguoi = xepHang(theoNguoi)
  const bangTo = xepHang(theoTo)
  const nsCaoNhat = Math.max(120, ...bangNguoi.map((n) => n.nangSuat ?? 0))

  const sangThanh = (n: (typeof bangNguoi)[number]): MucThanh => ({
    khoa: n.khoa,
    ten: n.ten,
    phu: n.phu === 'tổ' ? undefined : n.phu,
    giaTri: n.nangSuat ?? 0,
    nhan: n.nangSuat === null ? '—' : `${n.nangSuat}%`,
    dat: (n.nangSuat ?? 0) > 100,
  })

  const nhieuNguoi = bangNguoi.length > 16
  const dauBang = bangNguoi.slice(0, 8).map(sangThanh)
  const cuoiBang = bangNguoi.slice(-8).reverse().map(sangThanh)

  const soDat = bangNguoi.filter((n) => (n.nangSuat ?? 0) > 100).length
  const soChuaDat = bangNguoi.length - soDat

  // ----- Pareto sai hỏng -----
  const gopLoi = new Map<string, { ten: string; nhom: string; sl: number }>()
  for (const d of loi) {
    const k = d.defectType.name
    const g = gopLoi.get(k) ?? { ten: k, nhom: d.defectType.group, sl: 0 }
    g.sl += d.qty
    gopLoi.set(k, g)
  }
  const pareto = [...gopLoi.values()].sort((a, b) => b.sl - a.sl).slice(0, 12)

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
  const soTre = tienDo.filter((l) => l.canhBao).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <Header
        tieuDe="Bảng tổng hợp sản xuất"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)}`}
        nguoiDung={u}
      />

      {/* Bộ lọc kỳ + xuất Excel trên cùng một hàng */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {Object.entries(KY).map(([k, v]) => (
            <Link key={k} href={`/bang-dieu-khien?ky=${k}`} className={k === ky ? 'chip-bat' : 'chip-tat'}>
              {v.nhan}
            </Link>
          ))}
        </div>
        <form action="/bao-cao/xuat" method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Từ ngày</span>
            <input type="date" name="tu" defaultValue={ymd} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Đến ngày</span>
            <input type="date" name="den" defaultValue={ymd} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <button className="nut-phu">Tải CSV</button>
        </form>
      </div>

      {/* ---- Hàng chỉ số ---- */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <O
          nhan={`Sản phẩm đạt · ${nhanKy}`}
          so={tongDat.toLocaleString('vi-VN')}
          phu={lech(tongDat, truocDat, 'sp')}
        />
        <O
          nhan="Tỷ lệ đạt chất lượng"
          so={tyLeDat === null ? '—' : `${tyLeDat}%`}
          phu={lech(tyLeDat, truocTyLe, '%') ?? (tongHong > 0 ? `${tongHong} sản phẩm hỏng` : 'không có hỏng')}
        />
        <O
          nhan="Năng suất chung"
          so={chung.performance === null ? '—' : `${chung.performance}%`}
          phu={lech(chung.performance, truocChung.performance, '%') ?? `${Math.round(chung.netMinutes / 60)} giờ công`}
        />
        <O
          nhan="Cần xử lý"
          so={String(choDuyet + soTre)}
          phu={
            choDuyet + soTre === 0
              ? 'không có việc tồn'
              : `${choDuyet} bản ghi chờ duyệt · ${soTre} lệnh nguy cơ trễ`
          }
          canh={choDuyet + soTre > 0}
        />
      </section>

      {/* ---- Diễn biến ---- */}
      <section className="the mb-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            Diễn biến sản lượng {soNgay === 1 ? 'theo mốc giờ' : 'theo ngày'}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> đạt
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#dc2626]" /> hỏng
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-[#f59e0b]" /> năng suất %
            </span>
          </p>
        </div>
        <CotSanLuong diem={dienBien} />
      </section>

      {/* ---- Chất lượng và năng suất chung ---- */}
      <section className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="the">
          <h2 className="mb-3 font-semibold">Chất lượng · {nhanKy}</h2>
          <VongChatLuong dat={tongDat} hong={tongHong} />
        </div>
        <div className="the">
          <h2 className="mb-3 font-semibold">Năng suất chung · {nhanKy}</h2>
          <DongHoNangSuat ns={chung.performance} gio={Math.round(chung.netMinutes / 60)} />
        </div>
        <div className="the">
          <h2 className="mb-3 font-semibold">Người đạt ngưỡng</h2>
          {bangNguoi.length === 0 ? (
            <KhongCo chu="Chưa có bản ghi nào được duyệt." />
          ) : (
            <>
              <p className="text-3xl font-bold leading-tight">
                {soDat}
                <span className="text-lg font-medium text-slate-400">/{bangNguoi.length}</span>
              </p>
              <div className="mt-3 flex h-3 overflow-hidden rounded bg-slate-100">
                <span
                  className="h-full bg-emerald-600"
                  style={{ width: `${(soDat / bangNguoi.length) * 100}%` }}
                />
                <span
                  className="h-full bg-amber-500"
                  style={{ width: `${(soChuaDat / bangNguoi.length) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {soChuaDat} người chưa tới ngưỡng 100% trong kỳ này.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ---- Xếp hạng ---- */}
      <section className="mb-4 grid gap-3 lg:grid-cols-2">
        <div className="the">
          <h2 className="mb-3 font-semibold">Năng suất theo tổ · {nhanKy}</h2>
          <XepHangNgang muc={bangTo.map(sangThanh)} toiDa={nsCaoNhat} mocDat={100} />
        </div>
        <div className="the">
          <h2 className="mb-1 font-semibold">
            {nhieuNguoi ? 'Cao nhất và thấp nhất' : 'Năng suất theo người'} · {nhanKy}
          </h2>
          <p className="mb-3 text-xs text-slate-500">Vạch dọc là ngưỡng đạt 100%.</p>
          {nhieuNguoi ? (
            <>
              <XepHangNgang muc={dauBang} toiDa={nsCaoNhat} mocDat={100} />
              <p className="my-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                Thấp nhất
              </p>
              <XepHangNgang muc={cuoiBang} toiDa={nsCaoNhat} mocDat={100} />
            </>
          ) : (
            <XepHangNgang muc={bangNguoi.map(sangThanh)} toiDa={nsCaoNhat} mocDat={100} />
          )}
        </div>
      </section>

      {/* ---- Bảng chi tiết từng người ---- */}
      {bangNguoi.length > 0 && (
        <details className="the mb-4">
          <summary className="cursor-pointer font-semibold">
            Bảng chi tiết {bangNguoi.length} người
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Người</th>
                  <th className="pb-2 text-right font-medium">Năng suất</th>
                  <th className="pb-2 text-right font-medium">Giờ công</th>
                  <th className="pb-2 text-right font-medium">Đạt / lần nhập</th>
                </tr>
              </thead>
              <tbody>
                {bangNguoi.map((n) => (
                  <tr key={n.khoa} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{n.ten}</span>
                      <span className="ml-2 text-xs text-slate-500">{n.phu}</span>
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium ${
                        (n.nangSuat ?? 0) > 100 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {n.nangSuat === null ? '—' : `${n.nangSuat}%`}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                      {Math.round(n.phut / 60)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-600">
                      {n.soDat}/{n.soBanGhi}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ---- Tiến độ lệnh ---- */}
      <section className="the mb-4">
        <h2 className="mb-3 font-semibold">Lệnh đang chạy</h2>
        {tienDo.length === 0 ? (
          <KhongCo chu="Chưa có lệnh nào được phát hành." />
        ) : (
          <div className="flex flex-col gap-3">
            {tienDo.map((l) => (
              <div key={l.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {l.code} · {l.sanPham}
                  </p>
                  <p className="text-sm tabular-nums text-slate-600">
                    {l.xong.toLocaleString('vi-VN')}/{l.quantity.toLocaleString('vi-VN')} ({l.pct}%) ·{' '}
                    {l.tocDo} sp/ngày
                    {l.hong > 0 && ` · ${l.hong} hỏng`}
                  </p>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.min(100, l.pct)}%`,
                      backgroundColor: l.canhBao ? '#f59e0b' : '#2563eb',
                    }}
                  />
                </div>
                {l.canhBao && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[#dc2626]">
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

      {/* ---- Pareto sai hỏng ---- */}
      <section className="the">
        <h2 className="mb-1 font-semibold">Sai hỏng theo loại lỗi · {nhanKy}</h2>
        <p className="mb-3 text-xs text-slate-500">
          Cột đỏ là số sản phẩm hỏng, đường đen là phần trăm lũy kế. Tối đa 12 loại nhiều nhất.
        </p>
        <ParetoLoi muc={pareto} />
      </section>
    </main>
  )
}

function O({ nhan, so, phu, canh }: { nhan: string; so: string; phu?: string | null; canh?: boolean }) {
  return (
    <div className="the">
      <p className={`text-3xl font-bold leading-tight ${canh ? 'text-amber-700' : ''}`}>{so}</p>
      <p className="mt-1 text-xs font-medium text-slate-600">{nhan}</p>
      {phu && <p className="text-xs text-slate-400">{phu}</p>}
    </div>
  )
}
