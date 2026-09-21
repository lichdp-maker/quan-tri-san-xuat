'use client'

import { useState, useTransition } from 'react'
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
type CongNhan = { id: string; ma: string; ten: string; daNgoi: boolean }

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
  const [dangChon, setDangChon] = useState<string | null>(null) // id công nhân đang chọn
  const [gheSang, setGheSang] = useState<string | null>(null) // ghế đang rê qua
  const [bao, setBao] = useState<{ loi?: string; ok?: string } | null>(null)
  const [dangChay, batDau] = useTransition()

  const matA = ghe.filter((g) => g.side === 'A')
  const matB = ghe.filter((g) => g.side === 'B')

  function datNguoi(seatId: string, userId: string) {
    setBao(null)
    batDau(async () => {
      const kq = await ganNguoiVaoGhe(seatId, userId)
      setBao(kq.loi ? { loi: kq.loi } : { ok: 'Đã xếp chỗ' })
      setDangChon(null)
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

  function OGhe({ g }: { g: Ghe }) {
    const sang = gheSang === g.id
    const chonDuoc = dangChon && !g.nguoi && g.operationId

    return (
      <div
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
        onClick={() => {
          if (dangChon) datNguoi(g.id, dangChon)
        }}
        className={[
          'flex w-[9.5rem] shrink-0 flex-col gap-1.5 rounded-xl border-2 p-2.5 transition',
          sang
            ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100'
            : g.nguoi
              ? 'border-emerald-300 bg-emerald-50'
              : g.operationId
                ? 'border-dashed border-slate-300 bg-white'
                : 'border-dashed border-amber-300 bg-amber-50/50',
          chonDuoc ? 'cursor-pointer hover:border-brand-400' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {g.side}
            {g.seq}
          </span>
          {g.dinhMucGiay !== null && (
            <span className="text-[11px] tabular-nums text-slate-500">{g.dinhMucGiay}s</span>
          )}
        </div>

        {!coLenh ? (
          <p className="rounded-lg bg-slate-100 px-1.5 py-1 text-center text-[11px] leading-tight text-slate-500">
            Chọn lệnh &amp; ca ở trên
          </p>
        ) : (
          <select
            value={g.operationId ?? ''}
            onChange={(e) => doiNguyenCong(g.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={dangChay}
            className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-[11px] leading-tight disabled:opacity-60"
            title={g.tenNguyenCong ?? 'Chưa gán nguyên công'}
          >
            <option value="">— chọn nguyên công —</option>
            {nguyenCongs.map((nc) => (
              <option key={nc.id} value={nc.id}>
                {nc.ten} · {nc.giay}s
              </option>
            ))}
          </select>
        )}

        {g.nguoi ? (
          <div className="flex items-start justify-between gap-1 rounded-lg bg-white px-2 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold leading-tight">{g.nguoi.ten}</span>
              <span className="text-[11px] text-slate-500">{g.nguoi.ma}</span>
            </span>
            {!g.nguoi.daNhap && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  go(g.id)
                }}
                aria-label="Gỡ người khỏi vị trí"
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 px-2 py-2 text-center text-[11px] text-slate-400">
            {g.operationId ? 'Thả người vào đây' : 'Chưa có nguyên công'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Danh sách công nhân */}
      <aside className="the h-fit w-full lg:w-64">
        <p className="mb-1 font-semibold">Công nhân</p>
        <p className="mb-3 text-xs text-slate-500">
          Kéo tên vào vị trí trên dây chuyền. Trên điện thoại thì bấm chọn tên rồi bấm vào vị trí.
        </p>

        <div className="flex flex-wrap gap-1.5 lg:flex-col">
          {congNhan.map((c) => (
            <button
              key={c.id}
              draggable={!c.daNgoi}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
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
              <span className="block font-medium leading-tight">{c.ten}</span>
              <span className="text-[11px] opacity-70">
                {c.ma}
                {c.daNgoi && ' · đã xếp'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Sơ đồ dây chuyền */}
      <section className="min-w-0 flex-1">
        <div className="the">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Sơ đồ chỗ ngồi · {ngay}</p>
            <p className="text-sm text-slate-500">
              {tenLenh ?? 'Chưa chọn lệnh sản xuất'}
            </p>
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
            <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{bao.ok}</p>
          )}

          <div className="overflow-x-auto pb-2">
            <div className="min-w-max">
              {/* Mặt A */}
              <div className="mb-2 flex gap-2">
                {matA.map((g) => (
                  <OGhe key={g.id} g={g} />
                ))}
              </div>

              {/* Băng tải */}
              <div className="my-2 flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                  Băng chuyền
                </span>
                <span className="flex-1 border-t-2 border-dashed border-slate-400/70" />
                <span className="text-xs text-slate-600">→ chiều đi của sản phẩm</span>
              </div>

              {/* Mặt B */}
              <div className="mt-2 flex gap-2">
                {matB.map((g) => (
                  <OGhe key={g.id} g={g} />
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Viền xanh lá là vị trí đã có người. Viền vàng là vị trí chưa gán nguyên công — chưa xếp
            người vào được. Người đã nhập số liệu thì không gỡ khỏi vị trí được nữa.
          </p>
        </div>
      </section>
    </div>
  )
}
