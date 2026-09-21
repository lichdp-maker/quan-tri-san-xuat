'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ganNguoiVaoGhe, ganNguyenCongChoGhe, goNguoiKhoiGhe } from './actions'

type Nguoi = { id: string; ma: string; ten: string; daNhap?: boolean }
type Ghe = {
  id: string
  side: 'A' | 'B'
  seq: number
  operationId: string | null
  tenNguyenCong: string | null
  boPhan: string | null
  dinhMucGiay: number | null
  nguoi: Nguoi | null
}
type NguyenCong = { id: string; ten: string; boPhan: string; giay: number; conLai: number }
type CongNhan = { id: string; ma: string; ten: string; to: string; daNgoi: boolean }

/** Bỏ dấu để tìm kiếm gõ không dấu vẫn ra. */
function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export default function SoDoDayChuyen({
  ngay,
  coLenh,
  tenLenh,
  ghe,
  congNhan,
  nguyenCongs,
}: {
  ngay: string
  coLenh: boolean
  tenLenh: string | null
  ghe: Ghe[]
  congNhan: CongNhan[]
  nguyenCongs: NguyenCong[]
}) {
  const [dangChon, setDangChon] = useState<string | null>(null) // công nhân đang cầm trên tay
  const [gheSang, setGheSang] = useState<string | null>(null) // ghế đang rê qua
  const [moGhe, setMoGhe] = useState<string | null>(null) // ghế đang mở bảng xếp chỗ
  const [bao, setBao] = useState<{ loi?: string; ok?: string } | null>(null)
  const [locTo, setLocTo] = useState<string>('')
  const [tim, setTim] = useState('')
  const [anDaXep, setAnDaXep] = useState(true)
  const [che, setChe] = useState<'bang' | 'luoi'>('bang')
  const [dangChay, batDau] = useTransition()

  const khungRef = useRef<HTMLDivElement>(null)

  const dsTo = useMemo(() => [...new Set(congNhan.map((c) => c.to))].sort(), [congNhan])
  const soConTrong = congNhan.filter((c) => !c.daNgoi).length
  const daXep = ghe.filter((g) => g.nguoi).length
  const choTrong = ghe.filter((g) => !g.nguoi && g.operationId).length
  const chuaGanNC = ghe.filter((g) => !g.operationId).length

  const dsLoc = useMemo(() => {
    const k = khongDau(tim.trim())
    return congNhan
      .filter((c) => (!locTo || c.to === locTo) && (!anDaXep || !c.daNgoi))
      .filter((c) => !k || khongDau(c.ten).includes(k) || khongDau(c.ma).includes(k))
  }, [congNhan, locTo, anDaXep, tim])

  const nguoiDangCam = congNhan.find((c) => c.id === dangChon) ?? null
  const gheDangMo = ghe.find((g) => g.id === moGhe) ?? null

  const matA = ghe.filter((g) => g.side === 'A')
  const matB = ghe.filter((g) => g.side === 'B')

  // Esc để thoát bảng chọn / bỏ người đang cầm
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (moGhe) setMoGhe(null)
      else if (dangChon) setDangChon(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moGhe, dangChon])

  function datNguoi(seatId: string, userId: string) {
    setBao(null)
    batDau(async () => {
      const kq = await ganNguoiVaoGhe(seatId, userId)
      setBao(kq.loi ? { loi: kq.loi } : { ok: 'Đã xếp chỗ' })
      if (!kq.loi) {
        setDangChon(null)
        setMoGhe(null)
      }
    })
  }

  function go(seatId: string) {
    setBao(null)
    batDau(async () => {
      const kq = await goNguoiKhoiGhe(seatId)
      if (kq.loi) setBao({ loi: kq.loi })
    })
  }

  function doiNguyenCong(seatId: string, operationId: string) {
    setBao(null)
    batDau(async () => {
      const kq = await ganNguyenCongChoGhe(seatId, operationId)
      if (kq.loi) setBao({ loi: kq.loi })
    })
  }

  /** Kéo tới sát mép thì tự cuộn băng chuyền, khỏi phải thả giữa chừng. */
  function tuCuon(e: React.DragEvent) {
    const el = khungRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const mep = 90
    if (e.clientX - r.left < mep) el.scrollLeft -= 24
    else if (r.right - e.clientX < mep) el.scrollLeft += 24
  }

  function bamGhe(g: Ghe) {
    if (dangChon) {
      if (!g.operationId) {
        setBao({ loi: `Vị trí ${g.side}${g.seq} chưa gán nguyên công.` })
        return
      }
      datNguoi(g.id, dangChon)
      return
    }
    setMoGhe(g.id)
  }

  function OGhe({ g, rong }: { g: Ghe; rong?: boolean }) {
    const sang = gheSang === g.id
    const nhanDuoc = !!dangChon && !!g.operationId

    return (
      <button
        type="button"
        onDragOver={(e) => {
          e.preventDefault()
          setGheSang(g.id)
        }}
        onDragLeave={() => setGheSang(null)}
        onDrop={(e) => {
          e.preventDefault()
          setGheSang(null)
          const id = e.dataTransfer.getData('text/plain')
          if (id) datNguoi(g.id, id)
        }}
        onClick={() => bamGhe(g)}
        className={[
          'flex flex-col gap-1 rounded-xl border-2 p-2 text-left transition',
          rong ? 'w-full' : 'w-32 shrink-0',
          sang
            ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100'
            : g.nguoi
              ? 'border-emerald-300 bg-emerald-50'
              : g.operationId
                ? 'border-dashed border-slate-300 bg-white'
                : 'border-dashed border-amber-300 bg-amber-50/60',
          nhanDuoc ? 'ring-2 ring-brand-300 hover:border-brand-500 hover:bg-brand-50' : '',
          dangChon && !g.operationId ? 'opacity-50' : '',
        ].join(' ')}
      >
        <span className="flex items-center justify-between">
          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {g.side}
            {g.seq}
          </span>
          {g.dinhMucGiay !== null && (
            <span className="text-[11px] tabular-nums text-slate-500">{g.dinhMucGiay}s</span>
          )}
        </span>

        <span
          className={[
            'block truncate text-[11px] leading-tight',
            g.tenNguyenCong ? 'text-slate-600' : 'font-medium text-amber-700',
          ].join(' ')}
          title={g.tenNguyenCong ?? undefined}
        >
          {g.tenNguyenCong ?? 'Chưa có nguyên công'}
        </span>

        {g.nguoi ? (
          <span className="flex items-start justify-between gap-1 rounded-lg bg-white px-2 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold leading-tight">
                {g.nguoi.ten}
              </span>
              <span className="text-[11px] text-slate-500">{g.nguoi.ma}</span>
            </span>
            {!g.nguoi.daNhap && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Gỡ người khỏi vị trí"
                onClick={(e) => {
                  e.stopPropagation()
                  go(g.id)
                }}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                ✕
              </span>
            )}
          </span>
        ) : (
          <span
            className={[
              'block rounded-lg border border-dashed px-2 py-2 text-center text-[11px]',
              nhanDuoc
                ? 'border-brand-400 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-300 text-slate-400',
            ].join(' ')}
          >
            {nhanDuoc ? 'Bấm để xếp vào đây' : g.operationId ? 'Trống' : '—'}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh bám theo màn hình khi đang cầm một người */}
      {nguoiDangCam && (
        <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-brand-300 bg-brand-600 px-4 py-2.5 text-white shadow-[0_12px_28px_-12px_rgba(37,99,235,0.95)]">
          <p className="min-w-0 text-sm">
            <span className="opacity-80">Đang xếp </span>
            <strong className="truncate">{nguoiDangCam.ten}</strong>
            <span className="opacity-80"> — bấm vào một vị trí trống ({choTrong} chỗ)</span>
          </p>
          <button
            onClick={() => setDangChon(null)}
            className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Sơ đồ dây chuyền */}
      <section className="min-w-0">
        <div className="the">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Sơ đồ chỗ ngồi · {ngay}</p>
              <p className="text-xs text-slate-500">
                Đã xếp {daXep}/{ghe.length} vị trí
                {chuaGanNC > 0 && ` · ${chuaGanNC} vị trí chưa gán nguyên công`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="hidden text-sm text-slate-500 sm:block">
                {tenLenh ?? 'Chưa chọn lệnh sản xuất'}
              </p>
              <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs">
                <button
                  onClick={() => setChe('bang')}
                  className={`rounded-md px-2.5 py-1 ${che === 'bang' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  Băng chuyền
                </button>
                <button
                  onClick={() => setChe('luoi')}
                  className={`rounded-md px-2.5 py-1 ${che === 'luoi' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                >
                  Lưới gọn
                </button>
              </div>
            </div>
          </div>

          {!coLenh && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <p className="font-semibold">Chưa chọn lệnh sản xuất và ca cho dây chuyền</p>
              <p className="mt-0.5">
                Kéo lên khung phía trên, chọn lệnh và ca rồi bấm <strong>Lưu</strong>. Danh sách
                nguyên công lấy từ chính lệnh đó, nên chưa chọn lệnh thì chưa có gì để gán.
              </p>
            </div>
          )}

          {coLenh && nguyenCongs.length === 0 && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Lệnh đang chọn không có nguyên công nào. Kiểm tra lại ở mục Lệnh sản xuất.
            </p>
          )}

          {bao?.loi && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{bao.loi}</p>
          )}
          {bao?.ok && (
            <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {bao.ok}
            </p>
          )}

          {che === 'bang' ? (
            <div ref={khungRef} onDragOver={tuCuon} className="overflow-x-auto pb-2">
              <div className="min-w-max">
                <div className="mb-2 flex gap-2">
                  {matA.map((g) => (
                    <OGhe key={g.id} g={g} />
                  ))}
                </div>

                <div className="my-2 flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                    Băng chuyền
                  </span>
                  <span className="flex-1 border-t-2 border-dashed border-slate-400/70" />
                  <span className="text-xs text-slate-600">→ chiều đi của sản phẩm</span>
                </div>

                <div className="mt-2 flex gap-2">
                  {matB.map((g) => (
                    <OGhe key={g.id} g={g} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                { nhan: 'Mặt A', ds: matA },
                { nhan: 'Mặt B', ds: matB },
              ].map((m) => (
                <div key={m.nhan}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {m.nhan}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {m.ds.map((g) => (
                      <OGhe key={g.id} g={g} rong />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Bấm vào một vị trí để chọn nguyên công và chọn người ngay tại đó. Hoặc bấm tên người ở
            danh sách dưới rồi bấm vào vị trí. Trên máy tính vẫn kéo thả được. Người đã nhập số liệu
            thì không gỡ khỏi vị trí được nữa.
          </p>
        </div>
      </section>

      {/* Danh sách công nhân */}
      <section className="the">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            Công nhân{' '}
            <span className="text-sm font-normal text-slate-500">
              · {soConTrong} người chưa xếp / {congNhan.length}
            </span>
          </p>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={anDaXep}
              onChange={(e) => setAnDaXep(e.target.checked)}
            />
            Ẩn người đã xếp
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={tim}
            onChange={(e) => setTim(e.target.value)}
            placeholder="Tìm tên hoặc mã nhân viên…"
            className="o-nhap w-full py-2 sm:w-64"
          />
          {tim && (
            <button onClick={() => setTim('')} className="nut-phu px-2.5 py-1.5 text-xs">
              Xóa tìm
            </button>
          )}
        </div>

        {dsTo.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setLocTo('')} className={locTo === '' ? 'chip-bat' : 'chip-tat'}>
              Tất cả
            </button>
            {dsTo.map((t) => (
              <button
                key={t}
                onClick={() => setLocTo(locTo === t ? '' : t)}
                className={locTo === t ? 'chip-bat' : 'chip-tat'}
              >
                {t}
                <span className="ml-1 opacity-70">
                  {congNhan.filter((c) => c.to === t && !c.daNgoi).length}
                </span>
              </button>
            ))}
          </div>
        )}

        {dsLoc.length === 0 ? (
          <p className="text-sm text-slate-500">
            Không còn ai để xếp với bộ lọc hiện tại. Bỏ dấu tìm, chọn lại tổ, hoặc bỏ tích “Ẩn người
            đã xếp”.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {dsLoc.map((c) => (
              <button
                key={c.id}
                draggable={!c.daNgoi}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', c.id)
                  setDangChon(c.id)
                }}
                onDragEnd={() => setGheSang(null)}
                onClick={() => setDangChon(dangChon === c.id ? null : c.id)}
                disabled={c.daNgoi}
                className={[
                  'rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                  c.daNgoi
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                    : dangChon === c.id
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'cursor-grab border-slate-300 bg-white hover:border-brand-400',
                ].join(' ')}
              >
                <span className="block truncate font-medium leading-tight">{c.ten}</span>
                <span className="block truncate text-[11px] opacity-70">
                  {c.ma} · {c.to}
                  {c.daNgoi && ' · đã xếp'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Bảng xếp chỗ cho một vị trí */}
      {gheDangMo && (
        <BangGhe
          g={gheDangMo}
          coLenh={coLenh}
          nguyenCongs={nguyenCongs}
          congNhan={congNhan}
          dangChay={dangChay}
          dong={() => setMoGhe(null)}
          doiNguyenCong={doiNguyenCong}
          datNguoi={datNguoi}
          go={go}
        />
      )}
    </div>
  )
}

function BangGhe({
  g,
  coLenh,
  nguyenCongs,
  congNhan,
  dangChay,
  dong,
  doiNguyenCong,
  datNguoi,
  go,
}: {
  g: Ghe
  coLenh: boolean
  nguyenCongs: NguyenCong[]
  congNhan: CongNhan[]
  dangChay: boolean
  dong: () => void
  doiNguyenCong: (seatId: string, operationId: string) => void
  datNguoi: (seatId: string, userId: string) => void
  go: (seatId: string) => void
}) {
  const [tim, setTim] = useState('')
  const [moNC, setMoNC] = useState(!g.operationId)

  const k = khongDau(tim.trim())
  const ds = congNhan
    .filter((c) => !c.daNgoi)
    .filter((c) => !k || khongDau(c.ten).includes(k) || khongDau(c.ma).includes(k))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={dong} />
      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">
              Vị trí {g.side}
              {g.seq}
            </p>
            <p className="truncate text-xs text-slate-500">
              {g.tenNguyenCong ? `${g.tenNguyenCong} · ${g.dinhMucGiay}s` : 'Chưa gán nguyên công'}
            </p>
          </div>
          <button onClick={dong} aria-label="Đóng" className="nut-phu px-2.5 py-1">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* Bước 1 — nguyên công */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1 · Nguyên công
              </p>
              {g.operationId && (
                <button onClick={() => setMoNC((v) => !v)} className="text-xs text-brand-700">
                  {moNC ? 'Thu gọn' : 'Đổi nguyên công'}
                </button>
              )}
            </div>

            {!coLenh ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Chọn lệnh sản xuất và ca ở khung phía trên trước đã.
              </p>
            ) : moNC ? (
              <div className="flex flex-col gap-1">
                {nguyenCongs.map((nc) => (
                  <button
                    key={nc.id}
                    disabled={dangChay}
                    onClick={() => {
                      doiNguyenCong(g.id, nc.id)
                      setMoNC(false)
                    }}
                    className={[
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-60',
                      nc.id === g.operationId
                        ? 'border-brand-600 bg-brand-50 font-medium'
                        : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{nc.ten}</span>
                      <span className="text-[11px] text-slate-500">
                        {nc.boPhan} · còn {nc.conLai}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">{nc.giay}s</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm">
                {g.tenNguyenCong} · {g.dinhMucGiay}s
              </p>
            )}
          </div>

          {/* Bước 2 — người */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              2 · Người ngồi
            </p>

            {g.nguoi && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{g.nguoi.ten}</span>
                  <span className="text-xs text-slate-500">{g.nguoi.ma}</span>
                </span>
                {g.nguoi.daNhap ? (
                  <span className="shrink-0 text-xs text-slate-500">đã nhập số liệu</span>
                ) : (
                  <button
                    disabled={dangChay}
                    onClick={() => go(g.id)}
                    className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Gỡ ra
                  </button>
                )}
              </div>
            )}

            {!g.operationId ? (
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Chọn nguyên công ở bước 1 trước, rồi mới xếp người.
              </p>
            ) : (
              <>
                <input
                  value={tim}
                  onChange={(e) => setTim(e.target.value)}
                  placeholder="Tìm tên hoặc mã…"
                  className="o-nhap mb-2 w-full py-2"
                />
                {ds.length === 0 ? (
                  <p className="text-sm text-slate-500">Không còn ai chưa xếp khớp với ô tìm.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {ds.map((c) => (
                      <button
                        key={c.id}
                        disabled={dangChay}
                        onClick={() => datNguoi(g.id, c.id)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.ten}</span>
                          <span className="text-[11px] text-slate-500">
                            {c.ma} · {c.to}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-brand-700">Xếp vào →</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
