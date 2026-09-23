/**
 * Bộ biểu đồ cho bảng tổng hợp — vẽ thẳng bằng SVG, không cần thư viện ngoài.
 * Tất cả đều là server component: không có JS chạy ở máy người dùng, mở rất nhanh.
 * Số liệu luôn được viết thành chữ bên cạnh, màu chỉ là kênh phụ.
 */

export const MAU = {
  dat: '#2563eb',
  hong: '#dc2626',
  tot: '#059669',
  canh: '#f59e0b',
  luoi: '#e2e8f0',
  chu: '#64748b',
}

function lamTron(n: number) {
  if (n <= 0) return 1
  const bac = Math.pow(10, Math.floor(Math.log10(n)))
  return Math.ceil(n / bac) * bac
}

export function KhongCo({ chu }: { chu: string }) {
  return (
    <p className="flex h-40 items-center justify-center text-center text-sm text-slate-400">{chu}</p>
  )
}

/* ------------------------------------------------------------------ */
/* Cột sản lượng theo ngày / theo mốc giờ, kèm đường năng suất          */
/* ------------------------------------------------------------------ */

export type DiemSL = { nhan: string; dat: number; hong: number; ns: number | null }

export function CotSanLuong({ diem }: { diem: DiemSL[] }) {
  if (diem.length === 0) return <KhongCo chu="Chưa có sản lượng được duyệt trong kỳ này." />

  const W = 760
  const H = 250
  const T = 16
  const D = H - 30
  const L = 46
  const R = W - 46
  const rongO = (R - L) / diem.length

  const maxSL = lamTron(Math.max(...diem.map((d) => d.dat + d.hong), 1))
  const maxNS = Math.max(120, lamTron(Math.max(...diem.map((d) => d.ns ?? 0), 100)))

  const yS = (v: number) => D - (v / maxSL) * (D - T)
  const yN = (v: number) => D - (v / maxNS) * (D - T)

  const buoc = diem.length <= 12 ? 1 : Math.ceil(diem.length / 10)
  const coNS = diem.some((d) => d.ns !== null)
  const duongNS = diem
    .map((d, i) => (d.ns === null ? null : `${L + rongO * (i + 0.5)},${yN(d.ns)}`))
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Biểu đồ sản lượng và năng suất theo thời gian"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={L} x2={R} y1={yS(maxSL * p)} y2={yS(maxSL * p)} stroke={MAU.luoi} />
          <text x={L - 6} y={yS(maxSL * p) + 4} textAnchor="end" fontSize="11" fill={MAU.chu}>
            {Math.round(maxSL * p).toLocaleString('vi-VN')}
          </text>
          {coNS && (
            <text x={R + 6} y={yN(maxNS * p) + 4} fontSize="11" fill={MAU.canh}>
              {Math.round(maxNS * p)}%
            </text>
          )}
        </g>
      ))}

      {diem.map((d, i) => {
        const w = Math.max(6, rongO * 0.58)
        const x = L + rongO * (i + 0.5) - w / 2
        return (
          <g key={d.nhan}>
            <title>{`${d.nhan}: ${d.dat} đạt, ${d.hong} hỏng${d.ns !== null ? `, năng suất ${d.ns}%` : ''}`}</title>
            <rect x={x} y={yS(d.dat)} width={w} height={Math.max(0, D - yS(d.dat))} fill={MAU.dat} rx="2" />
            {d.hong > 0 && (
              <rect
                x={x}
                y={yS(d.dat + d.hong)}
                width={w}
                height={Math.max(1, yS(d.dat) - yS(d.dat + d.hong))}
                fill={MAU.hong}
                rx="2"
              />
            )}
            {i % buoc === 0 && (
              <text
                x={L + rongO * (i + 0.5)}
                y={H - 9}
                textAnchor="middle"
                fontSize="11"
                fill={MAU.chu}
              >
                {d.nhan}
              </text>
            )}
          </g>
        )
      })}

      {coNS && (
        <>
          <line
            x1={L}
            x2={R}
            y1={yN(100)}
            y2={yN(100)}
            stroke={MAU.canh}
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <polyline points={duongNS} fill="none" stroke={MAU.canh} strokeWidth="2.5" />
          {diem.map((d, i) =>
            d.ns === null ? null : (
              <circle
                key={d.nhan}
                cx={L + rongO * (i + 0.5)}
                cy={yN(d.ns)}
                r="3.5"
                fill="#fff"
                stroke={MAU.canh}
                strokeWidth="2"
              />
            ),
          )}
        </>
      )}

      <line x1={L} x2={R} y1={D} y2={D} stroke="#94a3b8" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Vòng tỷ lệ đạt chất lượng                                            */
/* ------------------------------------------------------------------ */

export function VongChatLuong({ dat, hong }: { dat: number; hong: number }) {
  const tong = dat + hong
  if (tong === 0) return <KhongCo chu="Chưa có sản phẩm nào trong kỳ." />

  const pct = (dat / tong) * 100
  const r = 54
  const chuVi = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label="Tỷ lệ đạt chất lượng">
        <circle cx="70" cy="70" r={r} fill="none" stroke={MAU.hong} strokeWidth="18" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={MAU.dat}
          strokeWidth="18"
          strokeDasharray={`${(pct / 100) * chuVi} ${chuVi}`}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="66" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0f172a">
          {pct.toFixed(1)}%
        </text>
        <text x="70" y="86" textAnchor="middle" fontSize="12" fill={MAU.chu}>
          đạt
        </text>
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: MAU.dat }} />
          <span className="tabular-nums font-medium">{dat.toLocaleString('vi-VN')}</span>
          <span className="text-slate-500">sản phẩm đạt</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: MAU.hong }} />
          <span className="tabular-nums font-medium">{hong.toLocaleString('vi-VN')}</span>
          <span className="text-slate-500">sản phẩm hỏng</span>
        </li>
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Đồng hồ năng suất chung                                              */
/* ------------------------------------------------------------------ */

function diem(cx: number, cy: number, r: number, goc: number) {
  const rad = (goc * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)]
}

export function DongHoNangSuat({ ns, gio }: { ns: number | null; gio: number }) {
  if (ns === null) return <KhongCo chu="Chưa đủ giờ công để tính năng suất." />

  const max = Math.max(150, lamTron(ns))
  const gocGT = 180 - Math.min(1, ns / max) * 180
  const goc100 = 180 - Math.min(1, 100 / max) * 180
  const [x1, y1] = diem(80, 78, 58, 180)
  const [x2, y2] = diem(80, 78, 58, 0)
  const [xv, yv] = diem(80, 78, 58, gocGT)
  const [mx1, my1] = diem(80, 78, 44, goc100)
  const [mx2, my2] = diem(80, 78, 72, goc100)

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 100" className="h-24 w-40 shrink-0" role="img" aria-label="Đồng hồ năng suất chung">
        <path
          d={`M ${x1} ${y1} A 58 58 0 0 1 ${x2} ${y2}`}
          fill="none"
          stroke={MAU.luoi}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M ${x1} ${y1} A 58 58 0 0 1 ${xv} ${yv}`}
          fill="none"
          stroke={ns > 100 ? MAU.tot : MAU.canh}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#0f172a" strokeWidth="2" />
        <text x="80" y="74" textAnchor="middle" fontSize="26" fontWeight="700" fill="#0f172a">
          {ns}%
        </text>
        <text x="80" y="92" textAnchor="middle" fontSize="11" fill={MAU.chu}>
          vạch đen = ngưỡng đạt 100%
        </text>
      </svg>
      <div className="text-sm">
        <p className={ns > 100 ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
          {ns > 100 ? 'Trên ngưỡng đạt' : 'Chưa tới ngưỡng đạt'}
        </p>
        <p className="mt-1 text-slate-500">{gio.toLocaleString('vi-VN')} giờ công trong kỳ</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Thanh ngang xếp hạng                                                 */
/* ------------------------------------------------------------------ */

export type MucThanh = { khoa: string; ten: string; phu?: string; giaTri: number; nhan: string; dat: boolean }

export function XepHangNgang({
  muc,
  toiDa,
  mocDat,
}: {
  muc: MucThanh[]
  toiDa: number
  mocDat?: number
}) {
  if (muc.length === 0) return <KhongCo chu="Chưa có số liệu." />
  const vachDat = mocDat !== undefined && toiDa > 0 ? Math.min(100, (mocDat / toiDa) * 100) : null

  return (
    <ul className="flex flex-col gap-2.5">
      {muc.map((m) => (
        <li key={m.khoa} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm sm:w-44" title={m.ten}>
            {m.ten}
            {m.phu && <span className="block text-xs text-slate-400">{m.phu}</span>}
          </span>
          <span className="relative h-3.5 flex-1 rounded bg-slate-100">
            <span
              className="block h-full rounded"
              style={{
                width: `${toiDa > 0 ? Math.max(1.5, Math.min(100, (m.giaTri / toiDa) * 100)) : 0}%`,
                backgroundColor: m.dat ? MAU.tot : MAU.canh,
              }}
            />
            {vachDat !== null && (
              <span
                aria-hidden
                className="absolute -top-0.5 w-px bg-slate-500"
                style={{ left: `${vachDat}%`, height: '1.125rem' }}
              />
            )}
          </span>
          <span className="w-24 shrink-0 text-right text-sm tabular-nums text-slate-700">
            {m.nhan}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Pareto sai hỏng — cột giảm dần kèm đường lũy kế                      */
/* ------------------------------------------------------------------ */

export type MucLoi = { ten: string; nhom: string; sl: number }

export function ParetoLoi({ muc }: { muc: MucLoi[] }) {
  if (muc.length === 0) return <KhongCo chu="Không có sản phẩm hỏng nào trong kỳ này." />

  const W = 760
  const H = 260
  const T = 16
  const D = H - 54
  const L = 46
  const R = W - 46
  const rongO = (R - L) / muc.length

  const tong = muc.reduce((a, m) => a + m.sl, 0)
  const maxSL = lamTron(muc[0].sl)
  const yS = (v: number) => D - (v / maxSL) * (D - T)
  const yP = (p: number) => D - (p / 100) * (D - T)

  let cong = 0
  const luyKe = muc.map((m) => {
    cong += m.sl
    return (cong / tong) * 100
  })
  const duong = luyKe.map((p, i) => `${L + rongO * (i + 0.5)},${yP(p)}`).join(' ')
  const soDen80 = luyKe.findIndex((p) => p >= 80) + 1

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Biểu đồ Pareto sai hỏng">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={L} x2={R} y1={yS(maxSL * p)} y2={yS(maxSL * p)} stroke={MAU.luoi} />
            <text x={L - 6} y={yS(maxSL * p) + 4} textAnchor="end" fontSize="11" fill={MAU.chu}>
              {Math.round(maxSL * p)}
            </text>
            <text x={R + 6} y={yP(p * 100) + 4} fontSize="11" fill={MAU.chu}>
              {Math.round(p * 100)}%
            </text>
          </g>
        ))}

        <line x1={L} x2={R} y1={yP(80)} y2={yP(80)} stroke="#0f172a" strokeWidth="1" strokeDasharray="5 4" />
        <text x={L + 4} y={yP(80) - 5} fontSize="11" fill="#0f172a">
          80% lũy kế
        </text>

        {muc.map((m, i) => {
          const w = Math.max(8, rongO * 0.6)
          const x = L + rongO * (i + 0.5) - w / 2
          return (
            <g key={m.ten}>
              <title>{`${m.ten} (${m.nhom}): ${m.sl} sản phẩm — ${Math.round((m.sl / tong) * 100)}%`}</title>
              <rect x={x} y={yS(m.sl)} width={w} height={Math.max(1, D - yS(m.sl))} fill={MAU.hong} rx="2" />
              <text
                x={L + rongO * (i + 0.5)}
                y={D + 16}
                textAnchor="middle"
                fontSize="11"
                fill={MAU.chu}
              >
                {m.ten.length > 14 ? `${m.ten.slice(0, 13)}…` : m.ten}
              </text>
              <text
                x={L + rongO * (i + 0.5)}
                y={D + 30}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
              >
                {m.sl}
              </text>
            </g>
          )
        })}

        <polyline points={duong} fill="none" stroke="#0f172a" strokeWidth="2" />
        {luyKe.map((p, i) => (
          <circle
            key={muc[i].ten}
            cx={L + rongO * (i + 0.5)}
            cy={yP(p)}
            r="3"
            fill="#fff"
            stroke="#0f172a"
            strokeWidth="2"
          />
        ))}
        <line x1={L} x2={R} y1={D} y2={D} stroke="#94a3b8" />
      </svg>

      <p className="mt-2 text-xs text-slate-500">
        {soDen80 > 0
          ? `${soDen80} loại lỗi đầu tiên đã chiếm 80% tổng số ${tong} sản phẩm hỏng — xử lý xong nhóm này là giải quyết được phần lớn.`
          : `Tổng ${tong} sản phẩm hỏng trong kỳ.`}
      </p>
    </div>
  )
}
