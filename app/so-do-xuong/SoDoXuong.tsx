'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { doiViTriChuyen } from '../day-chuyen/actions'

type Loai = 'CHUYEN' | 'BAN' | 'MAY'

type ViTri = {
  id: string
  ma: string
  ten: string
  loai: Loai
  tang: number
  x: number
  y: number
  rong: number
  cao: number
  soGhe: number
  soNguyenCong: number
  daXep: number
  to: string | null
  lenh: string | null
}

const MAU: Record<Loai, { vien: string; nen: string; chu: string }> = {
  CHUYEN: { vien: 'border-brand-400', nen: 'bg-brand-50', chu: 'text-brand-900' },
  BAN: { vien: 'border-emerald-400', nen: 'bg-emerald-50', chu: 'text-emerald-900' },
  MAY: { vien: 'border-slate-400', nen: 'bg-slate-100', chu: 'text-slate-700' },
}

const TEN_LOAI: Record<Loai, string> = {
  CHUYEN: 'Băng chuyền',
  BAN: 'Dãy bàn',
  MAY: 'Máy',
}

export default function SoDoXuong({
  viTris,
  duocSapXep,
}: {
  viTris: ViTri[]
  duocSapXep: boolean
}) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [sapXep, setSapXep] = useState(false)
  const [cho, setCho] = useState<ViTri[]>(viTris)
  const [bao, setBao] = useState<string | null>(null)

  const cacTang = [...new Set(cho.map((v) => v.tang))].sort((a, b) => b - a)

  function luuViTri(v: ViTri) {
    batDau(async () => {
      const kq = await doiViTriChuyen({
        lineId: v.id,
        tang: v.tang,
        viTriX: v.x,
        viTriY: v.y,
        rong: v.rong,
        cao: v.cao,
      })
      setBao(kq.loi ?? `Đã lưu vị trí ${v.ten}`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {sapXep
            ? 'Kéo khối để đặt lại vị trí. Thả ra là lưu.'
            : 'Bấm vào một vị trí để vào trang xếp chỗ và gán nguyên công cho chuyền đó.'}
        </p>
        {duocSapXep && (
          <button
            onClick={() => setSapXep((v) => !v)}
            className={sapXep ? 'nut-nho' : 'nut-phu px-3 py-2 text-sm'}
          >
            {sapXep ? 'Xong, thoát sắp xếp' : 'Sắp xếp mặt bằng'}
          </button>
        )}
      </div>

      {bao && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{bao}</p>}

      {cacTang.length === 0 ? (
        <p className="the text-sm text-slate-600">
          Chưa có dây chuyền nào. Vào <strong>Sơ đồ dây chuyền</strong> bấm “+ Thêm chuyền”.
        </p>
      ) : (
        cacTang.map((tang) => (
          <KhungTang
            key={tang}
            tang={tang}
            viTris={cho.filter((v) => v.tang === tang)}
            sapXep={sapXep && duocSapXep}
            dangChay={dangChay}
            keo={(id, x, y) =>
              setCho((ds) => ds.map((v) => (v.id === id ? { ...v, x, y } : v)))
            }
            thaRa={(id) => {
              const v = cho.find((c) => c.id === id)
              if (v) luuViTri(v)
            }}
            moChuyen={(id) => router.push(`/day-chuyen?dc=${id}`)}
          />
        ))
      )}

      <div className="flex flex-wrap gap-4 px-1 text-xs text-slate-500">
        {(Object.keys(TEN_LOAI) as Loai[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`h-3 w-5 rounded border-2 ${MAU[l].vien} ${MAU[l].nen}`} />
            {TEN_LOAI[l]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-emerald-500" />
          tỷ lệ chỗ đã có người hôm nay
        </span>
      </div>
    </div>
  )
}

function KhungTang({
  tang,
  viTris,
  sapXep,
  dangChay,
  keo,
  thaRa,
  moChuyen,
}: {
  tang: number
  viTris: ViTri[]
  sapXep: boolean
  dangChay: boolean
  keo: (id: string, x: number, y: number) => void
  thaRa: (id: string) => void
  moChuyen: (id: string) => void
}) {
  const khungRef = useRef<HTMLDivElement>(null)
  const dangKeo = useRef<{ id: string; lechX: number; lechY: number } | null>(null)

  const tongGhe = viTris.reduce((a, v) => a + v.soGhe, 0)
  const tongXep = viTris.reduce((a, v) => a + v.daXep, 0)

  /** Đổi toạ độ con trỏ sang phần trăm khung, để sơ đồ co giãn theo màn hình. */
  function phanTram(e: { clientX: number; clientY: number }) {
    const el = khungRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    }
  }

  return (
    <section className="the">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">Tầng {tang}</p>
        <p className="text-sm text-slate-500">
          {viTris.length} vị trí sản xuất · {tongXep}/{tongGhe} chỗ đã có người hôm nay
        </p>
      </div>

      <div
        ref={khungRef}
        onPointerMove={(e) => {
          if (!sapXep || !dangKeo.current) return
          const p = phanTram(e)
          if (!p) return
          keo(dangKeo.current.id, p.x - dangKeo.current.lechX, p.y - dangKeo.current.lechY)
        }}
        onPointerUp={() => {
          if (dangKeo.current) {
            thaRa(dangKeo.current.id)
            dangKeo.current = null
          }
        }}
        onPointerLeave={() => {
          if (dangKeo.current) {
            thaRa(dangKeo.current.id)
            dangKeo.current = null
          }
        }}
        className="relative h-[26rem] w-full overflow-hidden rounded-2xl border-2 border-slate-300 bg-[linear-gradient(to_right,rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,.18)_1px,transparent_1px)] bg-[size:2rem_2rem] sm:h-[30rem]"
      >
        {viTris.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Tầng này chưa có vị trí sản xuất nào
          </p>
        )}

        {viTris.map((v) => {
          const mau = MAU[v.loai]
          const tyLe = v.soGhe > 0 ? Math.round((v.daXep / v.soGhe) * 100) : 0

          return (
            <button
              key={v.id}
              onPointerDown={(e) => {
                if (!sapXep) return
                const p = phanTram(e)
                if (!p) return
                dangKeo.current = { id: v.id, lechX: p.x - v.x, lechY: p.y - v.y }
                ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              }}
              onClick={() => {
                if (!sapXep) moChuyen(v.id)
              }}
              disabled={dangChay && sapXep}
              style={{
                left: `${v.x}%`,
                top: `${v.y}%`,
                width: `${v.rong}%`,
                height: `${v.cao}%`,
              }}
              className={[
                'absolute flex flex-col justify-center overflow-hidden rounded-lg border-2 px-2 text-left transition',
                mau.vien,
                mau.nen,
                sapXep ? 'cursor-move touch-none' : 'cursor-pointer hover:brightness-95 hover:shadow-md',
              ].join(' ')}
              title={v.lenh ?? 'Chưa chọn lệnh sản xuất'}
            >
              <span className={`truncate text-xs font-semibold leading-tight ${mau.chu}`}>
                {v.ten}
              </span>
              <span className="truncate text-[10px] leading-tight text-slate-500">
                {v.loai === 'MAY'
                  ? TEN_LOAI[v.loai]
                  : `${v.daXep}/${v.soGhe} chỗ${v.soNguyenCong > 0 ? ` · ${v.soNguyenCong} NC` : ''}`}
              </span>

              {v.loai !== 'MAY' && v.soGhe > 0 && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-slate-200">
                  <span
                    className="block h-full bg-emerald-500 transition-all"
                    style={{ width: `${tyLe}%` }}
                  />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
