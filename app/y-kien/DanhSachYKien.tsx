'use client'

import { useState, useTransition } from 'react'
import { capNhatYKien } from './actions'

type YKien = {
  id: string
  loai: string
  noiDung: string
  trangThai: string
  phanHoi: string | null
  luc: string
  nguoi: string
  to: string | null
  noi: string
  xuLyBoi: string | null
  xuLyLuc: string | null
}

const TRANG_THAI: Record<string, { ten: string; mau: string }> = {
  MOI: { ten: 'Chưa xem', mau: 'bg-rose-100 text-rose-700' },
  DANG_XU_LY: { ten: 'Đang xử lý', mau: 'bg-amber-100 text-amber-800' },
  DA_XU_LY: { ten: 'Đã xử lý', mau: 'bg-emerald-100 text-emerald-800' },
}

export default function DanhSachYKien({ ds }: { ds: YKien[] }) {
  if (ds.length === 0) {
    return (
      <div className="the py-10 text-center">
        <div className="text-3xl" aria-hidden>
          ✓
        </div>
        <p className="mt-2 font-medium text-slate-700">Không có ý kiến nào ở mục này.</p>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {ds.map((y) => (
        <TheYKien key={y.id} y={y} />
      ))}
    </ul>
  )
}

function TheYKien({ y }: { y: YKien }) {
  const [moTraLoi, setMoTraLoi] = useState(false)
  const [phanHoi, setPhanHoi] = useState(y.phanHoi ?? '')
  const [trangThai, setTrangThai] = useState(y.trangThai)
  const [loi, setLoi] = useState<string | null>(null)
  const [dang, start] = useTransition()

  const tt = TRANG_THAI[trangThai] ?? TRANG_THAI.MOI
  const laVuong = y.loai === 'VUONG_MAC'

  function luu(moi: string, ph: string | null) {
    setLoi(null)
    const cu = trangThai
    setTrangThai(moi) // cập nhật lạc quan
    start(async () => {
      try {
        const kq = await capNhatYKien({ id: y.id, trangThai: moi, phanHoi: ph })
        if (kq.loi) {
          setTrangThai(cu)
          setLoi(kq.loi)
          return
        }
        setMoTraLoi(false)
      } catch {
        setTrangThai(cu)
        setLoi('Không lưu được — kiểm tra mạng rồi thử lại.')
      }
    })
  }

  return (
    <li className={`the border-l-4 ${laVuong ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-semibold uppercase ${laVuong ? 'text-rose-700' : 'text-emerald-700'}`}>
            {laVuong ? '⚠ Vướng mắc' : '💡 Đề xuất cải tiến'}
          </div>
          <div className="mt-0.5 truncate font-semibold text-slate-900">{y.nguoi}</div>
          <div className="truncate text-xs text-slate-500">
            {[y.to, y.noi, dinhDangLuc(y.luc)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${tt.mau}`}>{tt.ten}</span>
      </div>

      <p className="mt-3 whitespace-pre-line break-words text-base text-slate-800">{y.noiDung}</p>

      {y.phanHoi && !moTraLoi && (
        <p className="mt-3 rounded-lg border-l-4 border-brand-500 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-brand-700">Phản hồi{y.xuLyBoi ? ` (${y.xuLyBoi})` : ''}: </span>
          {y.phanHoi}
        </p>
      )}

      {moTraLoi && (
        <div className="mt-3">
          <textarea
            value={phanHoi}
            onChange={(e) => setPhanHoi(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Đã xử lý thế nào / hướng giải quyết…"
            className="o-nhap text-base"
            autoFocus
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={dang}
              onClick={() => luu('DANG_XU_LY', phanHoi.trim() || null)}
              className="nut-phu min-h-11"
            >
              Lưu · đang xử lý
            </button>
            <button
              type="button"
              disabled={dang || !phanHoi.trim()}
              onClick={() => luu('DA_XU_LY', phanHoi.trim())}
              className="nut-duyet min-h-11 disabled:opacity-50"
            >
              Xong · gửi phản hồi
            </button>
          </div>
        </div>
      )}

      {loi && (
        <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loi}
        </p>
      )}

      {!moTraLoi && (
        <div className="mt-3 flex flex-wrap gap-2">
          {trangThai === 'MOI' && (
            <button
              type="button"
              disabled={dang}
              onClick={() => luu('DANG_XU_LY', y.phanHoi)}
              className="nut-phu min-h-11"
            >
              Nhận xử lý
            </button>
          )}
          <button type="button" onClick={() => setMoTraLoi(true)} className="nut-nho min-h-11">
            {trangThai === 'DA_XU_LY' ? 'Sửa phản hồi' : 'Trả lời'}
          </button>
          {trangThai === 'DA_XU_LY' && (
            <button
              type="button"
              disabled={dang}
              onClick={() => luu('DANG_XU_LY', y.phanHoi)}
              className="nut-phu min-h-11"
            >
              Mở lại
            </button>
          )}
        </div>
      )}
    </li>
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
