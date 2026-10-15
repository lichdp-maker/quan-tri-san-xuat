'use client'

import { useState, useTransition } from 'react'
import { guiYKien } from './actions'

type Loai = 'VUONG_MAC' | 'CAI_TIEN'

type DaGui = {
  id: string
  loai: string
  noiDung: string
  trangThai: string
  phanHoi: string | null
  luc: string
}

const TEN_LOAI: Record<Loai, string> = {
  VUONG_MAC: 'Vướng mắc',
  CAI_TIEN: 'Đề xuất cải tiến',
}

const GOI_Y: Record<Loai, string> = {
  VUONG_MAC: 'VD: Máy 3 hay đứt chỉ, thiếu bán thành phẩm từ công đoạn trước…',
  CAI_TIEN: 'VD: Đổi vị trí khay để lấy hàng nhanh hơn, thêm gá cho đường may…',
}

const TRANG_THAI: Record<string, { ten: string; mau: string }> = {
  MOI: { ten: 'Chưa xem', mau: 'bg-slate-100 text-slate-600' },
  DANG_XU_LY: { ten: 'Đang xử lý', mau: 'bg-amber-100 text-amber-800' },
  DA_XU_LY: { ten: 'Đã xử lý', mau: 'bg-emerald-100 text-emerald-800' },
}

const TOI_DA = 1000

export default function YKienCuaToi({
  viec,
  daGui,
}: {
  viec: Array<{ assignmentId: string; nhan: string }>
  daGui: DaGui[]
}) {
  const [loai, setLoai] = useState<Loai>('VUONG_MAC')
  const [noiDung, setNoiDung] = useState('')
  const [assignmentId, setAssignmentId] = useState<string>(viec[0]?.assignmentId ?? '')
  const [loi, setLoi] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [dangGui, startGui] = useTransition()

  const conLai = TOI_DA - noiDung.length
  const duDai = noiDung.trim().length >= 5

  function gui() {
    setLoi(null)
    setOk(null)
    if (!duDai) {
      setLoi('Viết rõ hơn một chút (ít nhất 5 ký tự).')
      return
    }
    startGui(async () => {
      try {
        const kq = await guiYKien({ loai, noiDung: noiDung.trim(), assignmentId: assignmentId || null })
        if (kq.loi) {
          setLoi(kq.loi)
          return
        }
        setNoiDung('')
        setOk(`Đã gửi ${TEN_LOAI[loai].toLowerCase()} tới tổ trưởng.`)
      } catch {
        setLoi('Không gửi được — kiểm tra mạng rồi thử lại.')
      }
    })
  }

  return (
    <section className="the mt-5" aria-labelledby="tieu-de-y-kien">
      <h2 id="tieu-de-y-kien" className="text-lg font-bold text-slate-900">
        Vướng mắc · Đề xuất cải tiến
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">Gặp khó khăn hoặc có ý tưởng làm nhanh hơn? Gửi ngay cho tổ trưởng.</p>

      {/* Chọn loại */}
      <div role="radiogroup" aria-label="Loại ý kiến" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(Object.keys(TEN_LOAI) as Loai[]).map((k) => {
          const bat = loai === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={bat}
              onClick={() => setLoai(k)}
              className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition ${
                bat
                  ? k === 'VUONG_MAC'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {k === 'VUONG_MAC' ? '⚠ ' : '💡 '}
              {TEN_LOAI[k]}
            </button>
          )
        })}
      </div>

      {/* Việc liên quan */}
      {viec.length > 1 && (
        <label className="mt-3 block">
          <span className="nhan">Liên quan tới việc</span>
          <select
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            className="o-chon mt-1 min-h-11"
          >
            {viec.map((v) => (
              <option key={v.assignmentId} value={v.assignmentId}>
                {v.nhan}
              </option>
            ))}
            <option value="">Chung, không riêng việc nào</option>
          </select>
        </label>
      )}

      {/* Nội dung */}
      <label className="mt-3 block">
        <span className="sr-only">Nội dung</span>
        <textarea
          value={noiDung}
          onChange={(e) => setNoiDung(e.target.value.slice(0, TOI_DA))}
          rows={4}
          placeholder={GOI_Y[loai]}
          className="o-nhap resize-y text-base leading-relaxed"
          enterKeyHint="send"
        />
      </label>
      <div className="mt-1 flex justify-end text-xs tabular-nums text-slate-400">
        {conLai < 100 ? `Còn ${conLai} ký tự` : `${noiDung.length}/${TOI_DA}`}
      </div>

      {loi && (
        <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loi}
        </p>
      )}
      {ok && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {ok}
        </p>
      )}

      <button type="button" onClick={gui} disabled={dangGui || !duDai} className="nut-chinh mt-3 min-h-12">
        {dangGui ? 'Đang gửi…' : `Gửi ${TEN_LOAI[loai].toLowerCase()}`}
      </button>

      {/* Đã gửi */}
      {daGui.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="nhan">Bạn đã gửi gần đây</h3>
          <ul className="mt-2 space-y-2">
            {daGui.map((y) => {
              const tt = TRANG_THAI[y.trangThai] ?? TRANG_THAI.MOI
              return (
                <li key={y.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${y.loai === 'VUONG_MAC' ? 'text-rose-700' : 'text-emerald-700'}`}
                    >
                      {TEN_LOAI[y.loai as Loai] ?? y.loai}
                    </span>
                    <span className="text-slate-400">· {dinhDangLuc(y.luc)}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 font-medium ${tt.mau}`}>{tt.ten}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-800">{y.noiDung}</p>
                  {y.phanHoi && (
                    <p className="mt-2 rounded-lg border-l-4 border-brand-500 bg-white px-3 py-2 text-sm text-slate-700">
                      <span className="font-semibold text-brand-700">Phản hồi: </span>
                      {y.phanHoi}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

function dinhDangLuc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}
