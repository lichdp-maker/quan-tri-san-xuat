'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { chepPhanCong } from './actions'
import { themNgay, nhanNgay, cachNgay, SO_NGAY_TOI_DA } from '@/lib/ngay-xep'

function dinhDang(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export default function ThanhNgay({
  ngay,
  homNay,
  lineId,
  tenChuyen,
  duocChep,
}: {
  ngay: string
  homNay: string
  lineId: string | null
  tenChuyen: string | null
  duocChep: boolean
}) {
  const router = useRouter()
  const [moChep, setMoChep] = useState(false)
  const [tuNgay, setTuNgay] = useState(() => themNgay(ngay, -1))
  const [caXuong, setCaXuong] = useState(false)
  const [ghiDe, setGhiDe] = useState(false)
  const [bao, setBao] = useState<{ loi?: string; ok?: string } | null>(null)
  const [dangChay, batDau] = useTransition()

  const lech = cachNgay(homNay, ngay)
  const quaKhu = lech < 0

  function di(ymdMoi: string) {
    const q = new URLSearchParams()
    if (lineId) q.set('dc', lineId)
    q.set('ngay', ymdMoi)
    router.push(`/day-chuyen?${q.toString()}`)
  }

  function chep() {
    setBao(null)
    batDau(async () => {
      const kq = await chepPhanCong({
        tuNgay,
        denNgay: ngay,
        lineId: caXuong ? undefined : (lineId ?? undefined),
        ghiDe,
      })
      setBao(kq.loi ? { loi: kq.loi } : { ok: kq.chu ?? 'Đã chép xong' })
      if (!kq.loi) {
        setMoChep(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="mb-4">
      <div className="the flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Đang xếp cho ngày
          </p>
          <p className="font-semibold leading-tight">
            {nhanNgay(ngay, homNay)}
            <span className="ml-1.5 font-normal text-slate-500">{dinhDang(ngay)}</span>
          </p>
        </div>

        <span className="hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => di(homNay)} className={lech === 0 ? 'chip-bat' : 'chip-tat'}>
            Hôm nay
          </button>
          <button
            onClick={() => di(themNgay(homNay, 1))}
            className={lech === 1 ? 'chip-bat' : 'chip-tat'}
          >
            Ngày mai
          </button>
          <input
            type="date"
            value={ngay}
            min={themNgay(homNay, -30)}
            max={themNgay(homNay, SO_NGAY_TOI_DA)}
            onChange={(e) => e.target.value && di(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm"
          />
        </div>

        <span className="flex-1" />

        {duocChep && !quaKhu && (
          <button onClick={() => setMoChep((v) => !v)} className="nut-phu shrink-0">
            ⧉ Chép từ ngày khác
          </button>
        )}
      </div>

      {quaKhu && (
        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Đây là ngày đã qua — chỉ xem lại, không sửa được chỗ ngồi.
        </p>
      )}

      {bao?.ok && (
        <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {bao.ok}
        </p>
      )}
      {bao?.loi && (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {bao.loi}
        </p>
      )}

      {moChep && (
        <div className="the mt-2">
          <p className="mb-3 font-semibold">
            Chép sắp xếp sang ngày {nhanNgay(ngay, homNay).toLowerCase()} {dinhDang(ngay)}
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Lấy của ngày</span>
              <input
                type="date"
                value={tuNgay}
                max={themNgay(homNay, SO_NGAY_TOI_DA)}
                onChange={(e) => setTuNgay(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-2 text-sm"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Phạm vi</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCaXuong(false)}
                  className={!caXuong ? 'chip-bat' : 'chip-tat'}
                  disabled={!lineId}
                >
                  Chỉ {tenChuyen ?? 'chuyền này'}
                </button>
                <button
                  onClick={() => setCaXuong(true)}
                  className={caXuong ? 'chip-bat' : 'chip-tat'}
                >
                  Cả xưởng
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input type="checkbox" checked={ghiDe} onChange={(e) => setGhiDe(e.target.checked)} />
              Ghi đè chỗ đã xếp
            </label>

            <button disabled={dangChay} onClick={chep} className="nut-nho">
              {dangChay ? 'Đang chép…' : 'Chép sang ngày này'}
            </button>
            <button onClick={() => setMoChep(false)} className="nut-phu">
              Đóng
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Chép theo vị trí: ai ngồi chỗ nào ngày {dinhDang(tuNgay)} thì ngồi đúng chỗ đó ngày{' '}
            {dinhDang(ngay)}. Nguyên công lấy theo lệnh đang chạy hiện tại của chuyền. Không tích
            “ghi đè” thì chỗ nào đã có người sẽ được giữ nguyên; chỗ đã nhập sản lượng thì không bao
            giờ bị ghi đè.
          </p>
        </div>
      )}
    </div>
  )
}
