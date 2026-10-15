'use client'

/**
 * Màn hình nhập sản lượng của công nhân — dùng trên điện thoại, một tay, ngoài xưởng.
 * Thứ tự đúng như người dùng nhìn: VỊ TRÍ → CHUYỀN · CHỖ → NGUYÊN CÔNG → ĐẠT / HỎNG → MÃ LỖI.
 * Thời gian làm / dừng máy đã điền sẵn theo mốc, thu gọn — chỉ mở khi cần sửa.
 */

import { useMemo, useState, useTransition } from 'react'
import { luuSanLuong } from './actions'
import { suggestMinutes } from '@/lib/productivity'

type Slot = { id: string; label: string; startTime: string; endTime: string; soPhut: number; daBatDau: boolean }

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
  loi: Array<{ defectTypeId: string; qty: number }>
}

type PhanCong = {
  id: string
  tenChuyen: string | null
  viTri: string | null
  tenNguyenCong: string
  maNguyenCong: string
  sanPham: string
  maLenh: string
  dinhMucGiay: number
  banGhi: BanGhi[]
}

type LoaiLoi = { id: string; ma: string; ten: string; nhom: string }
type LyDo = { id: string; ten: string }

type Dong = {
  qtyOk: string
  qtyDefect: string
  workedMinutes: string
  downtimeMinutes: string
  downtimeReasonId: string
  /** mã lỗi đã chọn → số lượng (chuỗi). Chọn 1 mã thì số lượng = số hỏng. */
  loi: Record<string, string>
  moThoiGian: boolean
}

const so = (v: string) => (v.trim() === '' ? 0 : Number(v))
const chiSo = (v: string) => v.replace(/\D/g, '').slice(0, 6)

export default function ManHinhNhap({
  slots,
  phanCong,
  loaiLoi,
  lyDoDung,
}: {
  slots: Slot[]
  phanCong: PhanCong[]
  loaiLoi: LoaiLoi[]
  lyDoDung: LyDo[]
}) {
  // Mặc định mở mốc đã bắt đầu mà chưa nhập; không có thì mốc gần nhất đã bắt đầu
  const mocMacDinh = useMemo(() => {
    const daBatDau = slots.filter((s) => s.daBatDau)
    const chuaNhap = daBatDau.find((s) => !phanCong.some((p) => p.banGhi.some((b) => b.timeSlotId === s.id)))
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
        qtyDefect: cu && cu.qtyDefect > 0 ? String(cu.qtyDefect) : '',
        workedMinutes: cu ? String(cu.workedMinutes) : String(phutGoiY),
        downtimeMinutes: cu && cu.downtimeMinutes > 0 ? String(cu.downtimeMinutes) : '',
        downtimeReasonId: cu?.downtimeReasonId ?? '',
        loi: Object.fromEntries((cu?.loi ?? []).map((l) => [l.defectTypeId, String(l.qty)])),
        moThoiGian: false,
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

  const tongPhut = phanCong.reduce((a, p) => a + so(gtri[p.id]?.workedMinutes ?? ''), 0)
  const vuotGio = moc ? tongPhut > moc.soPhut : false

  function doi(id: string, sua: Partial<Dong>) {
    setGtri((t) => ({ ...t, [id]: { ...t[id], ...sua } }))
    setThongBao({})
  }

  /** Mã lỗi gửi lên: chọn 1 mã thì lấy cả số hỏng; nhiều mã thì theo số đã chia. */
  function loiGui(d: Dong) {
    const chon = Object.keys(d.loi)
    if (so(d.qtyDefect) === 0) return []
    if (chon.length === 1) return [{ defectTypeId: chon[0], qty: so(d.qtyDefect) }]
    return chon.map((k) => ({ defectTypeId: k, qty: so(d.loi[k]) })).filter((x) => x.qty > 0)
  }

  function gui() {
    if (!moc) return
    const coSo = phanCong.map((p) => ({ p, d: gtri[p.id] })).filter(({ d }) => d && (so(d.qtyOk) > 0 || so(d.qtyDefect) > 0))
    if (coSo.length === 0) {
      setThongBao({ loi: 'Chưa nhập số lượng nào.' })
      return
    }
    // Kiểm ngay trên máy cho nhanh — máy chủ vẫn kiểm lại
    for (const { p, d } of coSo) {
      const hong = so(d.qtyDefect)
      if (hong === 0) continue
      const ds = loiGui(d)
      if (ds.length === 0) {
        setThongBao({ loi: `${p.tenNguyenCong}: có ${hong} sản phẩm hỏng — chọn mã lỗi.` })
        return
      }
      const tong = ds.reduce((a, x) => a + x.qty, 0)
      if (tong !== hong) {
        setThongBao({ loi: `${p.tenNguyenCong}: đã chia ${tong} theo mã lỗi, phải đủ ${hong} sản phẩm hỏng.` })
        return
      }
    }

    const dong = coSo.map(({ p, d }) => ({
      assignmentId: p.id,
      qtyOk: so(d.qtyOk),
      qtyDefect: so(d.qtyDefect),
      workedMinutes: so(d.workedMinutes),
      downtimeMinutes: so(d.downtimeMinutes),
      downtimeReasonId: d.downtimeReasonId || null,
      loi: loiGui(d),
    }))

    batDauLuu(async () => {
      try {
        const kq = await luuSanLuong(JSON.stringify({ timeSlotId: moc.id, dong }))
        setThongBao(kq)
      } catch {
        setThongBao({ loi: 'Mất kết nối — số chưa được lưu. Kiểm tra wifi rồi bấm Lưu lại.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- Mốc giờ ---------- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Báo sản lượng mốc</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {slots.map((s) => {
            const daNhap = phanCong.some((p) => p.banGhi.some((b) => b.timeSlotId === s.id))
            const chon = s.id === mocId
            return (
              <button
                key={s.id}
                onClick={() => setMocId(s.id)}
                className={[
                  'min-h-11 shrink-0 rounded-xl border-2 px-4 text-base font-semibold',
                  chon ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-800',
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
          <p className="mt-2 text-sm text-slate-600">
            Làm từ {moc.startTime} đến {moc.endTime} ·{' '}
            <span className={vuotGio ? 'font-semibold text-red-600' : ''}>
              {tongPhut}/{moc.soPhut} phút
            </span>
            {!moc.daBatDau && <span className="text-amber-700"> · mốc này chưa tới</span>}
          </p>
        )}
      </div>

      {/* ---------- Từng việc ---------- */}
      {phanCong.map((p, i) => {
        const d = gtri[p.id]
        if (!d) return null
        const cu = p.banGhi.find((b) => b.timeSlotId === mocId)
        const hong = so(d.qtyDefect)
        const maChon = Object.keys(d.loi)
        const daChia = maChon.length > 1 ? maChon.reduce((a, k) => a + so(d.loi[k]), 0) : hong
        const daDuyet = cu?.status === 'APPROVED'

        return (
          <section key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_28px_-14px_rgba(15,23,42,0.25)]">
            {/* 1–3. Vị trí hôm nay · chuyền · chỗ · nguyên công */}
            <div className="bg-gradient-to-br from-brand-700 to-brand-500 px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
                {phanCong.length > 1 ? `Việc ${i + 1}/${phanCong.length} · ` : ''}Vị trí của bạn hôm nay
              </p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p className="min-w-0 text-xl font-bold leading-tight">{p.tenChuyen ?? 'Chưa xếp chỗ ngồi'}</p>
                {p.viTri && (
                  <span className="shrink-0 rounded-xl bg-white px-3 py-1 text-xl font-extrabold leading-tight text-brand-700">
                    {p.viTri}
                  </span>
                )}
              </div>
              <p className="mt-2 text-lg font-semibold leading-snug">{p.tenNguyenCong}</p>
              <p className="mt-0.5 text-sm text-white/80">
                Định mức {p.dinhMucGiay} giây/sp · lệnh {p.maLenh}
              </p>
            </div>

            <div className="flex flex-col gap-4 px-4 py-4">
              {cu && (
                <p className={`rounded-xl px-3 py-2 text-sm ${daDuyet ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  Đã lưu {cu.qtyOk} đạt{cu.qtyDefect > 0 ? `, ${cu.qtyDefect} hỏng` : ''}
                  {cu.performance !== null && (
                    <>
                      {' '}· năng suất <strong>{cu.performance}%</strong> {cu.isAchieved ? '(đạt)' : '(chưa đạt)'}
                    </>
                  )}
                  {daDuyet ? ' · đã duyệt' : ' · chờ duyệt'}
                </p>
              )}

              {/* 4. Đạt — Hỏng */}
              <BoDem nhan="Đạt" mau="emerald" gtri={d.qtyOk} doi={(v) => doi(p.id, { qtyOk: v })} khoa={daDuyet} />
              <BoDem
                nhan="Hỏng"
                mau="red"
                gtri={d.qtyDefect}
                doi={(v) => doi(p.id, { qtyDefect: v, ...(so(v) === 0 ? { loi: {} } : {}) })}
                khoa={daDuyet}
              />

              {/* Mã lỗi — chỉ hiện khi có hỏng */}
              {hong > 0 && (
                <ChonMaLoi
                  loaiLoi={loaiLoi}
                  hong={hong}
                  loi={d.loi}
                  daChia={daChia}
                  doi={(loi) => doi(p.id, { loi })}
                />
              )}

              {/* Thời gian — đã điền sẵn, thu gọn */}
              {!d.moThoiGian ? (
                <button
                  onClick={() => doi(p.id, { moThoiGian: true })}
                  className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 text-left"
                >
                  <span className="text-sm text-slate-700">
                    <strong>{so(d.workedMinutes)}</strong> phút làm
                    {so(d.downtimeMinutes) > 0 ? (
                      <> · <strong className="text-amber-700">{so(d.downtimeMinutes)}</strong> phút dừng máy</>
                    ) : (
                      ' · không dừng máy'
                    )}
                  </span>
                  <span className="text-sm font-semibold text-brand-700">Sửa</span>
                </button>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Phút làm</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={d.workedMinutes}
                        onChange={(e) => doi(p.id, { workedMinutes: chiSo(e.target.value) })}
                        className="input-so"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Phút dừng máy</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={d.downtimeMinutes}
                        onChange={(e) => doi(p.id, { downtimeMinutes: chiSo(e.target.value) })}
                        className="input-so"
                        placeholder="0"
                      />
                    </label>
                  </div>
                  {so(d.downtimeMinutes) > 0 && (
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Lý do dừng</span>
                      <select
                        value={d.downtimeReasonId}
                        onChange={(e) => doi(p.id, { downtimeReasonId: e.target.value })}
                        className="o-chon text-base"
                      >
                        <option value="">— chọn lý do —</option>
                        {lyDoDung.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.ten}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>
          </section>
        )
      })}

      {thongBao.loi && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-base text-red-700" role="alert">
          {thongBao.loi}
        </p>
      )}
      {thongBao.ok && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-base text-emerald-800">
          Đã lưu mốc {moc?.label}, chờ tổ trưởng duyệt.
        </p>
      )}
      {thongBao.canhBao?.map((c) => (
        <p key={c} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {c}
        </p>
      ))}

      {/* Nút lưu dính đáy, trong tầm ngón cái */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-gradient-to-t from-slate-50 via-slate-50/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <button onClick={gui} disabled={dangLuu || vuotGio || !moc} className="nut-chinh min-h-14 text-lg">
          {dangLuu ? 'Đang lưu…' : vuotGio ? `Quá ${tongPhut - (moc?.soPhut ?? 0)} phút — sửa thời gian` : `Lưu sản lượng mốc ${moc?.label ?? ''}`}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ô đếm có nút − / + to cho một tay                                    */
/* ------------------------------------------------------------------ */

function BoDem({
  nhan,
  mau,
  gtri,
  doi,
  khoa,
}: {
  nhan: string
  mau: 'emerald' | 'red'
  gtri: string
  doi: (v: string) => void
  khoa: boolean
}) {
  const n = so(gtri)
  const vien = mau === 'emerald' ? 'text-emerald-700' : 'text-red-600'
  return (
    <div className="flex items-center gap-3">
      <span className={`w-14 shrink-0 text-lg font-bold ${vien}`}>{nhan}</span>
      <button
        type="button"
        disabled={khoa || n === 0}
        onClick={() => doi(String(Math.max(0, n - 1)))}
        aria-label={`Bớt 1 ${nhan.toLowerCase()}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200 disabled:opacity-40"
      >
        −
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        value={gtri}
        disabled={khoa}
        onChange={(e) => doi(chiSo(e.target.value))}
        placeholder="0"
        aria-label={nhan}
        className="input-so h-14 min-w-0 flex-1"
      />
      <button
        type="button"
        disabled={khoa}
        onClick={() => doi(String(n + 1))}
        aria-label={`Thêm 1 ${nhan.toLowerCase()}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200 disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chọn mã lỗi: chạm để chọn; nhiều mã thì chia số lượng cho từng mã    */
/* ------------------------------------------------------------------ */

function khongDau(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

function ChonMaLoi({
  loaiLoi,
  hong,
  loi,
  daChia,
  doi,
}: {
  loaiLoi: LoaiLoi[]
  hong: number
  loi: Record<string, string>
  daChia: number
  doi: (loi: Record<string, string>) => void
}) {
  const [tim, setTim] = useState('')
  const chon = Object.keys(loi)
  const k = khongDau(tim.trim())
  const hien = loaiLoi.filter((l) => !k || khongDau(l.ma).includes(k) || khongDau(l.ten).includes(k))
  const nhom = [...new Set(hien.map((l) => l.nhom))]

  function bat(id: string) {
    const moi = { ...loi }
    if (moi[id] !== undefined) delete moi[id]
    else moi[id] = Object.keys(moi).length === 0 ? String(hong) : ''
    doi(moi)
  }

  const conThieu = hong - daChia

  return (
    <div className="rounded-xl border-2 border-red-100 bg-red-50/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-800">Mã lỗi</p>
        {chon.length === 0 ? (
          <p className="text-sm font-medium text-red-600">Chọn ít nhất 1 mã</p>
        ) : chon.length > 1 && conThieu !== 0 ? (
          <p className="text-sm font-medium text-red-600">
            {conThieu > 0 ? `Còn ${conThieu} chưa chia` : `Thừa ${-conThieu}`}
          </p>
        ) : (
          <p className="text-sm font-medium text-emerald-700">✓ đủ {hong}</p>
        )}
      </div>

      {loaiLoi.length > 8 && (
        <input
          value={tim}
          onChange={(e) => setTim(e.target.value)}
          placeholder="Tìm mã hoặc tên lỗi…"
          className="o-nhap mb-2 w-full py-2.5 text-base"
        />
      )}

      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {nhom.map((n) => (
          <div key={n}>
            {nhom.length > 1 && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{n}</p>
            )}
            <div className="flex flex-col gap-1.5">
              {hien
                .filter((l) => l.nhom === n)
                .map((l) => {
                  const dangChon = loi[l.id] !== undefined
                  return (
                    <div key={l.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => bat(l.id)}
                        className={[
                          'flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 px-3 text-left',
                          dangChon ? 'border-red-500 bg-white' : 'border-slate-200 bg-white',
                        ].join(' ')}
                      >
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-sm font-bold ${
                            dangChon ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {l.ma}
                        </span>
                        <span className="min-w-0 flex-1 text-base leading-tight text-slate-800">{l.ten}</span>
                        {dangChon && <span className="shrink-0 text-lg text-red-600">✓</span>}
                      </button>
                      {dangChon && chon.length > 1 && (
                        <input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={loi[l.id]}
                          onChange={(e) => doi({ ...loi, [l.id]: chiSo(e.target.value) })}
                          placeholder="SL"
                          aria-label={`Số lượng lỗi ${l.ma}`}
                          className="h-12 w-16 shrink-0 rounded-xl border-2 border-red-200 bg-white text-center text-lg font-semibold tabular-nums"
                        />
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
        {hien.length === 0 && <p className="text-sm text-slate-500">Không có mã lỗi nào khớp “{tim}”.</p>}
      </div>
      {chon.length > 1 && (
        <p className="mt-2 text-xs text-slate-600">Nhiều loại lỗi: nhập số lượng cho từng mã, cộng lại đủ {hong}.</p>
      )}
    </div>
  )
}
