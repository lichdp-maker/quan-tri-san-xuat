'use client'

import { useMemo, useState, useTransition } from 'react'
import { luuSanLuong } from './actions'
import { suggestMinutes } from '@/lib/productivity'

type Slot = {
  id: string
  label: string
  startTime: string
  endTime: string
  soPhut: number
  daBatDau: boolean
}

type BanGhi = {
  timeSlotId: string
  qtyOk: number
  qtyDefect: number
  workedMinutes: number
  downtimeMinutes: number
  downtimeReasonId: string | null
  performance: number | null
  isAchieved: boolean | null
  status: string
}

type PhanCong = {
  id: string
  tenNguyenCong: string
  maNguyenCong: string
  boPhan: string
  sanPham: string
  maLenh: string
  dinhMucGiay: number
  conLai: number
  chiTieuCa: number | null
  banGhi: BanGhi[]
}

type Danh = { id: string; name: string }

type Dong = {
  qtyOk: string
  qtyDefect: string
  workedMinutes: string
  downtimeMinutes: string
  downtimeReasonId: string
  defectTypeId: string
}

export default function ManHinhNhap({
  slots,
  phanCong,
  loaiLoi,
  lyDoDung,
}: {
  slots: Slot[]
  phanCong: PhanCong[]
  loaiLoi: Danh[]
  lyDoDung: Danh[]
}) {
  const mocMacDinh = useMemo(() => {
    const daBatDau = slots.filter((s) => s.daBatDau)
    const chuaNhap = daBatDau.find(
      (s) => !phanCong.some((p) => p.banGhi.some((b) => b.timeSlotId === s.id)),
    )
    return chuaNhap?.id ?? daBatDau.at(-1)?.id ?? slots[0]?.id ?? ''
  }, [slots, phanCong])

  const [mocId, setMocId] = useState(mocMacDinh)
  const moc = slots.find((s) => s.id === mocId)
  const phutGoiY = moc ? suggestMinutes(moc.soPhut, phanCong.length) : 0

  const khoiTao = (): Record<string, Dong> => {
    const o: Record<string, Dong> = {}
    for (const p of phanCong) {
      const cu = p.banGhi.find((b) => b.timeSlotId === mocId)
      o[p.id] = {
        qtyOk: cu ? String(cu.qtyOk) : '',
        qtyDefect: cu ? String(cu.qtyDefect) : '',
        workedMinutes: cu ? String(cu.workedMinutes) : String(phutGoiY),
        downtimeMinutes: cu ? String(cu.downtimeMinutes) : '',
        downtimeReasonId: cu?.downtimeReasonId ?? '',
        defectTypeId: '',
      }
    }
    return o
  }

  const [gtri, setGtri] = useState<Record<string, Dong>>(khoiTao)
  const [mocDaVe, setMocDaVe] = useState(mocId)
  if (mocDaVe !== mocId) {
    setMocDaVe(mocId)
    setGtri(khoiTao())
  }

  const [dangLuu, batDauLuu] = useTransition()
  const [thongBao, setThongBao] = useState<{ ok?: boolean; loi?: string; canhBao?: string[] }>({})

  const so = (v: string) => (v.trim() === '' ? 0 : Number(v))
  const tongPhut = phanCong.reduce((a, p) => a + so(gtri[p.id]?.workedMinutes ?? ''), 0)
  const vuotGio = moc ? tongPhut > moc.soPhut : false

  function doi(id: string, khoa: keyof Dong, v: string) {
    setGtri((t) => ({ ...t, [id]: { ...t[id], [khoa]: v } }))
    setThongBao({})
  }

  function gui() {
    if (!moc) return
    const dong = phanCong
      .map((p) => ({ p, d: gtri[p.id] }))
      .filter(({ d }) => d && (so(d.qtyOk) > 0 || so(d.qtyDefect) > 0))
      .map(({ p, d }) => ({
        assignmentId: p.id,
        qtyOk: so(d.qtyOk),
        qtyDefect: so(d.qtyDefect),
        workedMinutes: so(d.workedMinutes),
        downtimeMinutes: so(d.downtimeMinutes),
        downtimeReasonId: d.downtimeReasonId || null,
        defectTypeId: d.defectTypeId || null,
      }))

    if (dong.length === 0) {
      setThongBao({ loi: 'Chưa nhập số lượng nào.' })
      return
    }

    batDauLuu(async () => {
      const kq = await luuSanLuong(JSON.stringify({ timeSlotId: moc.id, dong }))
      setThongBao(kq)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Chọn mốc giờ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {slots.map((s) => {
          const daNhap = phanCong.some((p) => p.banGhi.some((b) => b.timeSlotId === s.id))
          const chon = s.id === mocId
          return (
            <button
              key={s.id}
              onClick={() => setMocId(s.id)}
              className={[
                'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold',
                chon ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white',
                !s.daBatDau && !chon ? 'text-slate-400' : '',
              ].join(' ')}
            >
              {s.label}
              {daNhap && <span className={chon ? 'ml-1' : 'ml-1 text-emerald-600'}>✓</span>}
            </button>
          )
        })}
      </div>

      {moc && (
        <p className="text-sm text-slate-500">
          Mốc {moc.label}: sản lượng làm được từ {moc.startTime} đến {moc.endTime} ·{' '}
          <span className={vuotGio ? 'font-semibold text-red-600' : ''}>
            {tongPhut}/{moc.soPhut} phút
          </span>
        </p>
      )}

      {phanCong.map((p) => {
        const d = gtri[p.id]
        if (!d) return null
        const cu = p.banGhi.find((b) => b.timeSlotId === mocId)
        return (
          <section key={p.id} className="the flex flex-col gap-3">
            <div>
              <p className="font-semibold leading-tight">{p.tenNguyenCong}</p>
              <p className="text-xs text-slate-500">
                {p.sanPham} · {p.boPhan} · lệnh {p.maLenh} · định mức {p.dinhMucGiay}s
              </p>
              {cu && (
                <p className="mt-1 text-xs">
                  Đã lưu: {cu.qtyOk} đạt
                  {cu.performance !== null && (
                    <span className={cu.isAchieved ? 'text-emerald-600' : 'text-amber-600'}>
                      {' '}· năng suất {cu.performance}% {cu.isAchieved ? '(đạt)' : '(chưa đạt)'}
                    </span>
                  )}
                  {cu.status === 'PENDING' && <span className="text-slate-500"> · chờ duyệt</span>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Đạt</span>
                <input
                  inputMode="numeric"
                  value={d.qtyOk}
                  onChange={(e) => doi(p.id, 'qtyOk', e.target.value.replace(/\D/g, ''))}
                  className="input-so"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Hỏng</span>
                <input
                  inputMode="numeric"
                  value={d.qtyDefect}
                  onChange={(e) => doi(p.id, 'qtyDefect', e.target.value.replace(/\D/g, ''))}
                  className="input-so"
                  placeholder="0"
                />
              </label>
            </div>

            {so(d.qtyDefect) > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Loại lỗi</span>
                <select
                  value={d.defectTypeId}
                  onChange={(e) => doi(p.id, 'defectTypeId', e.target.value)}
                  className="rounded-lg border-2 border-slate-300 px-3 py-2"
                >
                  <option value="">— chọn loại lỗi —</option>
                  {loaiLoi.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Phút làm</span>
                <input
                  inputMode="numeric"
                  value={d.workedMinutes}
                  onChange={(e) => doi(p.id, 'workedMinutes', e.target.value.replace(/\D/g, ''))}
                  className="input-so"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Phút dừng</span>
                <input
                  inputMode="numeric"
                  value={d.downtimeMinutes}
                  onChange={(e) => doi(p.id, 'downtimeMinutes', e.target.value.replace(/\D/g, ''))}
                  className="input-so"
                  placeholder="0"
                />
              </label>
            </div>

            {so(d.downtimeMinutes) > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Lý do dừng</span>
                <select
                  value={d.downtimeReasonId}
                  onChange={(e) => doi(p.id, 'downtimeReasonId', e.target.value)}
                  className="rounded-lg border-2 border-slate-300 px-3 py-2"
                >
                  <option value="">— chọn lý do —</option>
                  {lyDoDung.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
        )
      })}

      {thongBao.loi && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {thongBao.loi}
        </p>
      )}
      {thongBao.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã lưu, chờ tổ trưởng duyệt.
        </p>
      )}
      {thongBao.canhBao?.map((c) => (
        <p key={c} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {c}
        </p>
      ))}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-slate-50 via-slate-50 px-4 pb-4 pt-6">
        <button onClick={gui} disabled={dangLuu || vuotGio} className="nut-chinh">
          {dangLuu ? 'Đang lưu...' : 'Lưu sản lượng'}
        </button>
      </div>
    </div>
  )
}
