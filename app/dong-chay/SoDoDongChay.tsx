'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  boNguyenCong,
  doiThuTuNguyenCong,
  dungLaiNguyenCong,
  suaNguyenCong,
  themBoPhan,
  themNguyenCong,
} from './actions'

type NguyenCong = {
  id: string
  ma: string
  ten: string
  chiTiet: string | null
  giay: number
  nguong: number
  laQC: boolean
  dangDung: boolean
  soLenh: number
  soGhe: number
}
type BoPhan = {
  id: string
  code: string
  ten: string
  phuThuocTatCa: boolean
  nguyenCongs: NguyenCong[]
}
type SanPham = { id: string; code: string; ten: string; donVi: string; laBo: boolean }
type Bao = { loi?: string; ok?: string }

/** Bộ điều khiển dùng chung cho các thành phần con. */
type DK = {
  duocSua: boolean
  dangChay: boolean
  chay: (fn: () => Promise<void>) => void
  bao: (b: Bao) => void
  keo: { boPhan: string; id: string } | null
  setKeo: (k: { boPhan: string; id: string } | null) => void
  doiCho: (boPhanId: string, tuId: string, denId: string) => void
  luuThuTu: (boPhanId: string, ds: string[]) => void
  day: (boPhanId: string, id: string, huong: -1 | 1) => void
  thuTu: Record<string, string[]>
}

function dinhDangGiay(giay: number): string {
  if (giay < 60) return `${giay}s`
  const p = Math.floor(giay / 60)
  const s = giay % 60
  return s === 0 ? `${p} phút` : `${p}p${String(s).padStart(2, '0')}`
}

// ============================================================
// MỘT NGUYÊN CÔNG TRONG DÒNG CHẢY
// ============================================================
function ONguyenCong({
  o,
  stt,
  dau,
  cuoi,
  boPhanId,
  lonNhat,
  dk,
}: {
  o: NguyenCong
  stt: number
  dau: boolean
  cuoi: boolean
  boPhanId: string
  lonNhat: number
  dk: DK
}) {
  const [sua, setSua] = useState(false)
  const [ten, setTen] = useState(o.ten)
  const [giay, setGiay] = useState(String(o.giay))
  const [chiTiet, setChiTiet] = useState(o.chiTiet ?? '')
  const [xacNhanXoa, setXacNhanXoa] = useState(false)

  const dangKeo = dk.keo?.id === o.id

  if (sua) {
    return (
      <div className="rounded-xl border-2 border-brand-400 bg-brand-50/50 p-3">
        <div className="flex flex-col gap-2">
          <input
            value={ten}
            onChange={(e) => setTen(e.target.value)}
            className="o-nhap py-2 text-sm"
            placeholder="Tên nguyên công"
          />
          <input
            value={chiTiet}
            onChange={(e) => setChiTiet(e.target.value)}
            className="o-nhap py-2 text-sm"
            placeholder="Mô tả thao tác (không bắt buộc)"
          />
          <div className="flex items-center gap-2">
            <input
              value={giay}
              onChange={(e) => setGiay(e.target.value)}
              inputMode="numeric"
              className="o-nhap w-24 py-2 text-center text-sm"
            />
            <span className="text-xs text-slate-500">giây/đơn vị</span>
            <span className="flex-1" />
            <button onClick={() => setSua(false)} className="nut-phu px-2.5 py-1.5 text-xs">
              Hủy
            </button>
            <button
              disabled={dk.dangChay}
              onClick={() =>
                dk.chay(async () => {
                  const kq = await suaNguyenCong({
                    id: o.id,
                    name: ten,
                    giay: Number(giay),
                    detail: chiTiet,
                  })
                  dk.bao(kq.loi ? { loi: kq.loi } : { ok: 'Đã lưu nguyên công' })
                  if (!kq.loi) setSua(false)
                })
              }
              className="nut-nho px-3 py-1.5 text-xs"
            >
              Lưu
            </button>
          </div>
          {o.soLenh > 0 && (
            <p className="text-[11px] text-amber-700">
              Nguyên công này đang nằm trong {o.soLenh} lệnh. Sửa định mức ở đây không làm đổi số liệu
              của lệnh đã phát — mỗi lệnh giữ định mức tại thời điểm phát lệnh.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      draggable={dk.duocSua}
      onDragStart={() => dk.setKeo({ boPhan: boPhanId, id: o.id })}
      onDragEnd={() => {
        if (dk.keo?.boPhan === boPhanId) dk.luuThuTu(boPhanId, dk.thuTu[boPhanId] ?? [])
        dk.setKeo(null)
      }}
      onDragOver={(e) => {
        if (!dk.keo || dk.keo.boPhan !== boPhanId) return
        e.preventDefault()
        dk.doiCho(boPhanId, dk.keo.id, o.id)
      }}
      className={[
        'flex items-start gap-2 rounded-xl border px-2.5 py-2 transition',
        dangKeo
          ? 'border-brand-500 bg-brand-50 opacity-60'
          : o.laQC
            ? 'border-violet-200 bg-violet-50/60'
            : 'border-slate-200 bg-white hover:border-brand-300',
        dk.duocSua ? 'cursor-grab' : '',
      ].join(' ')}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold tabular-nums text-white">
        {stt}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium leading-tight">
            {o.ten}
            {o.laQC && (
              <span className="ml-1.5 rounded bg-violet-200 px-1 text-[10px] font-semibold text-violet-800">
                KT
              </span>
            )}
          </p>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
            {dinhDangGiay(o.giay)}
          </span>
        </div>

        {o.chiTiet && <p className="truncate text-[11px] text-slate-500">{o.chiTiet}</p>}

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={o.laQC ? 'h-full rounded-full bg-violet-400' : 'h-full rounded-full bg-brand-500'}
            style={{ width: `${Math.round((o.giay / lonNhat) * 100)}%` }}
          />
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-slate-400">
            {o.ma}
            {o.soGhe > 0 && ` · ${o.soGhe} vị trí`}
            {o.soLenh > 0 && ` · ${o.soLenh} lệnh`}
          </span>

          {dk.duocSua && (
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => dk.day(boPhanId, o.id, -1)}
                disabled={dau || dk.dangChay}
                aria-label="Lên trước"
                className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => dk.day(boPhanId, o.id, 1)}
                disabled={cuoi || dk.dangChay}
                aria-label="Xuống sau"
                className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
              >
                ▼
              </button>
              <button
                onClick={() => setSua(true)}
                aria-label="Sửa"
                className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
              >
                ✎
              </button>
              <button
                onClick={() => {
                  if (!xacNhanXoa) {
                    setXacNhanXoa(true)
                    setTimeout(() => setXacNhanXoa(false), 4000)
                    return
                  }
                  dk.chay(async () => {
                    const kq = await boNguyenCong(o.id)
                    dk.bao(kq.loi ? { loi: kq.loi } : { ok: 'Đã bỏ nguyên công khỏi dòng chảy' })
                  })
                }}
                aria-label="Bỏ khỏi dòng chảy"
                className={
                  xacNhanXoa
                    ? 'rounded bg-red-600 px-1.5 text-[11px] font-medium text-white'
                    : 'rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-600'
                }
              >
                {xacNhanXoa ? 'Chắc chắn?' : '✕'}
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// THÊM NGUYÊN CÔNG VÀO CUỐI NHÁNH
// ============================================================
function FormThem({ boPhanId, dk }: { boPhanId: string; dk: DK }) {
  const [mo, setMo] = useState(false)
  const [ten, setTen] = useState('')
  const [giay, setGiay] = useState('')

  if (!mo) {
    return (
      <button
        onClick={() => setMo(true)}
        className="mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"
      >
        + Thêm nguyên công vào cuối nhánh
      </button>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-brand-300 bg-brand-50/50 p-3">
      <input
        autoFocus
        value={ten}
        onChange={(e) => setTen(e.target.value)}
        placeholder="Tên nguyên công"
        className="o-nhap py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <input
          value={giay}
          onChange={(e) => setGiay(e.target.value)}
          placeholder="giây"
          inputMode="numeric"
          className="o-nhap w-24 py-2 text-center text-sm"
        />
        <span className="text-xs text-slate-500">giây/đơn vị</span>
        <span className="flex-1" />
        <button onClick={() => setMo(false)} className="nut-phu px-2.5 py-1.5 text-xs">
          Hủy
        </button>
        <button
          disabled={dk.dangChay}
          onClick={() =>
            dk.chay(async () => {
              const kq = await themNguyenCong({ sectionId: boPhanId, name: ten, giay: Number(giay) })
              dk.bao(kq.loi ? { loi: kq.loi } : { ok: 'Đã thêm nguyên công' })
              if (!kq.loi) {
                setTen('')
                setGiay('')
                setMo(false)
              }
            })
          }
          className="nut-nho px-3 py-1.5 text-xs"
        >
          Thêm
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Thêm vào cuối nhánh, sau đó kéo hoặc bấm ▲▼ để đưa về đúng vị trí trong dòng chảy.
      </p>
    </div>
  )
}

// ============================================================
// MỘT NHÁNH CỦA DÒNG CHẢY
// ============================================================
function Nhanh({ s, ds, dk }: { s: BoPhan; ds: NguyenCong[]; dk: DK }) {
  const ngung = s.nguyenCongs.filter((o) => !o.dangDung)
  const tong = ds.reduce((a, o) => a + o.giay, 0)
  const lonNhat = Math.max(1, ...ds.map((o) => o.giay))

  return (
    <section className="the flex min-w-0 flex-col">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {s.ten}
            {s.phuThuocTatCa && (
              <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                chờ đủ các nhánh
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {s.code} · {ds.length} nguyên công
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-brand-700">{dinhDangGiay(tong)}</p>
      </div>

      <ol className="flex flex-col">
        {ds.map((o, i) => (
          <li key={o.id}>
            {i > 0 && <div className="ml-[1.35rem] h-3 w-px bg-slate-300" aria-hidden />}
            <ONguyenCong
              o={o}
              stt={i + 1}
              dau={i === 0}
              cuoi={i === ds.length - 1}
              boPhanId={s.id}
              lonNhat={lonNhat}
              dk={dk}
            />
          </li>
        ))}
      </ol>

      {ds.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-400">
          Nhánh này chưa có nguyên công nào
        </p>
      )}

      {dk.duocSua && <FormThem boPhanId={s.id} dk={dk} />}

      {ngung.length > 0 && (
        <details className="mt-3 border-t border-slate-200 pt-2">
          <summary className="cursor-pointer text-xs text-slate-500">
            {ngung.length} nguyên công đã ngừng dùng
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {ngung.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500"
              >
                <span className="min-w-0 truncate line-through">{o.ten}</span>
                {dk.duocSua && (
                  <button
                    disabled={dk.dangChay}
                    onClick={() =>
                      dk.chay(async () => {
                        const kq = await dungLaiNguyenCong(o.id)
                        if (kq.loi) dk.bao({ loi: kq.loi })
                      })
                    }
                    className="shrink-0 text-brand-700 hover:underline"
                  >
                    Dùng lại
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

// ============================================================
// THÊM NHÁNH MỚI CHO SẢN PHẨM
// ============================================================
function FormThemNhanh({ sanPhamId, dk }: { sanPhamId: string; dk: DK }) {
  const [mo, setMo] = useState(false)
  const [code, setCode] = useState('')
  const [ten, setTen] = useState('')
  const [chot, setChot] = useState(false)

  if (!mo) {
    return (
      <button
        onClick={() => setMo(true)}
        className="self-start rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"
      >
        + Thêm nhánh mới cho sản phẩm
      </button>
    )
  }

  return (
    <div className="the flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-600">Mã nhánh</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="o-nhap w-28 py-2 uppercase"
          placeholder="VD: KT"
        />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-xs text-slate-600">Tên nhánh</span>
        <input
          value={ten}
          onChange={(e) => setTen(e.target.value)}
          className="o-nhap py-2"
          placeholder="VD: Kiểm tra xuất xưởng"
        />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input type="checkbox" checked={chot} onChange={(e) => setChot(e.target.checked)} />
        Chờ đủ các nhánh khác
      </label>
      <button onClick={() => setMo(false)} className="nut-phu px-3 py-2 text-sm">
        Hủy
      </button>
      <button
        disabled={dk.dangChay}
        onClick={() =>
          dk.chay(async () => {
            const kq = await themBoPhan({ productId: sanPhamId, code, name: ten, phuThuocTatCa: chot })
            dk.bao(kq.loi ? { loi: kq.loi } : { ok: 'Đã thêm nhánh' })
            if (!kq.loi) {
              setCode('')
              setTen('')
              setMo(false)
            }
          })
        }
        className="nut-nho"
      >
        Thêm nhánh
      </button>
    </div>
  )
}

// ============================================================
// TRANG SƠ ĐỒ DÒNG CHẢY
// ============================================================
export default function SoDoDongChay({
  sanPham,
  boPhans,
  duocSua,
}: {
  sanPham: SanPham
  boPhans: BoPhan[]
  duocSua: boolean
}) {
  const [bao, setBao] = useState<Bao | null>(null)
  const [keo, setKeo] = useState<{ boPhan: string; id: string } | null>(null)
  const [dangChay, batDau] = useTransition()

  const macDinh = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const s of boPhans) m[s.id] = s.nguyenCongs.filter((o) => o.dangDung).map((o) => o.id)
    return m
  }, [boPhans])
  const khoa = Object.entries(macDinh)
    .map(([k, v]) => `${k}:${v.join(',')}`)
    .join('|')

  // Thứ tự giữ ở máy người dùng để kéo thả hiện ngay, lưu xuống máy chủ khi thả
  const [thuTu, setThuTu] = useState<Record<string, string[]>>(macDinh)
  useEffect(() => setThuTu(macDinh), [khoa]) // eslint-disable-line react-hooks/exhaustive-deps

  const tra = useMemo(() => {
    const m = new Map<string, NguyenCong>()
    for (const s of boPhans) for (const o of s.nguyenCongs) m.set(o.id, o)
    return m
  }, [boPhans])

  const tongGiay = boPhans.reduce(
    (a, s) => a + s.nguyenCongs.filter((o) => o.dangDung).reduce((b, o) => b + o.giay, 0),
    0,
  )
  const soNC = boPhans.reduce((a, s) => a + s.nguyenCongs.filter((o) => o.dangDung).length, 0)

  const songSong = boPhans.filter((s) => !s.phuThuocTatCa)
  const chotCuoi = boPhans.filter((s) => s.phuThuocTatCa)

  const dk: DK = {
    duocSua,
    dangChay,
    chay: (fn) => {
      setBao(null)
      batDau(fn)
    },
    bao: setBao,
    keo,
    setKeo,
    thuTu,
    doiCho: (boPhanId, tuId, denId) =>
      setThuTu((cu) => {
        const ds = [...(cu[boPhanId] ?? [])]
        const i = ds.indexOf(tuId)
        const j = ds.indexOf(denId)
        if (i < 0 || j < 0 || i === j) return cu
        ds.splice(j, 0, ...ds.splice(i, 1))
        return { ...cu, [boPhanId]: ds }
      }),
    luuThuTu: (boPhanId, ds) =>
      batDau(async () => {
        const kq = await doiThuTuNguyenCong(boPhanId, ds)
        setBao(kq.loi ? { loi: kq.loi } : { ok: 'Đã lưu thứ tự mới' })
      }),
    day: (boPhanId, id, huong) => {
      const ds = [...(thuTu[boPhanId] ?? [])]
      const i = ds.indexOf(id)
      const j = i + huong
      if (i < 0 || j < 0 || j >= ds.length) return
      ;[ds[i], ds[j]] = [ds[j], ds[i]]
      setThuTu((cu) => ({ ...cu, [boPhanId]: ds }))
      batDau(async () => {
        const kq = await doiThuTuNguyenCong(boPhanId, ds)
        setBao(kq.loi ? { loi: kq.loi } : { ok: 'Đã lưu thứ tự mới' })
      })
    },
  }

  const dsCua = (s: BoPhan) =>
    (thuTu[s.id] ?? []).map((id) => tra.get(id)).filter(Boolean) as NguyenCong[]

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-4 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Dòng chảy công nghệ
            </p>
            <p className="mt-1 truncate text-xl font-bold leading-tight sm:text-2xl">{sanPham.ten}</p>
            <p className="mt-0.5 text-sm text-white/70">
              Mã {sanPham.code} · đơn vị {sanPham.donVi}
              {sanPham.laBo && ` · bộ gồm ${songSong.length} nhánh chạy song song`}
            </p>
          </div>
          <div className="flex items-end gap-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/60">Nguyên công</p>
              <p className="text-3xl font-bold leading-none tabular-nums">{soNC}</p>
            </div>
            <div className="border-l border-white/20 pl-5">
              <p className="text-[11px] uppercase tracking-wider text-white/60">Tổng định mức</p>
              <p className="text-3xl font-bold leading-none tabular-nums">{tongGiay}s</p>
              <p className="mt-0.5 text-xs text-white/70">≈ {dinhDangGiay(tongGiay)}/đơn vị</p>
            </div>
          </div>
        </div>
      </section>

      {bao?.loi && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{bao.loi}</p>}
      {bao?.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{bao.ok}</p>
      )}

      {duocSua && (
        <p className="text-xs text-slate-500">
          Kéo thẻ nguyên công để đổi vị trí trong nhánh, hoặc bấm ▲▼ — thứ tự lưu ngay khi thả. Đổi
          định mức chỉ ảnh hưởng lệnh phát về sau; lệnh đang chạy giữ định mức lúc phát lệnh nên số
          liệu cũ không bị xô lệch.
        </p>
      )}

      <div
        className={[
          'grid gap-4',
          songSong.length >= 3
            ? 'md:grid-cols-2 xl:grid-cols-3'
            : songSong.length === 2
              ? 'md:grid-cols-2'
              : '',
        ].join(' ')}
      >
        {songSong.map((s) => (
          <Nhanh key={s.id} s={s} ds={dsCua(s)} dk={dk} />
        ))}
      </div>

      {chotCuoi.length > 0 && (
        <>
          <div className="flex items-center gap-3 px-2">
            <span className="flex-1 border-t-2 border-dashed border-slate-300" />
            <span className="rounded-full bg-slate-200 px-3 py-1 text-center text-xs font-medium text-slate-700">
              ↓ hợp lưu — {songSong.length} nhánh phải xong mới vào bước dưới
            </span>
            <span className="flex-1 border-t-2 border-dashed border-slate-300" />
          </div>
          <div className="grid gap-4">
            {chotCuoi.map((s) => (
              <Nhanh key={s.id} s={s} ds={dsCua(s)} dk={dk} />
            ))}
          </div>
        </>
      )}

      {duocSua && <FormThemNhanh sanPhamId={sanPham.id} dk={dk} />}
    </div>
  )
}
