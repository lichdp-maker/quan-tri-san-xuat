'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { doiViTriChuyen } from '../day-chuyen/actions'

type Loai = 'CHUYEN' | 'BAN' | 'MAY'

type Ghe = {
  id: string
  mat: 'A' | 'B'
  so: number
  coNguyenCong: boolean
  tenNguyenCong: string | null
  nguoi: string | null
}

type ViTri = {
  id: string
  ma: string
  ten: string
  loai: Loai
  tang: number
  x: number
  y: number
  rong: number
  soNguyenCong: number
  to: string | null
  lenh: string | null
  ghe: Ghe[]
}

const MAU: Record<Loai, { vien: string; nen: string; chu: string }> = {
  CHUYEN: { vien: 'border-brand-400', nen: 'bg-brand-50/80', chu: 'text-brand-900' },
  BAN: { vien: 'border-violet-400', nen: 'bg-violet-50/80', chu: 'text-violet-900' },
  MAY: { vien: 'border-slate-400', nen: 'bg-slate-100/90', chu: 'text-slate-700' },
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

  // Luôn vẽ tầng 1 và tầng 2 dù tầng đó chưa có chuyền nào, để còn chỗ mà kéo
  // chuyền xuống. Tầng khác chỉ hiện khi thực sự có chuyền.
  const cacTang = [...new Set([2, 1, ...cho.map((v) => v.tang)])].sort((a, b) => b - a)

  function luuViTri(v: ViTri) {
    batDau(async () => {
      const kq = await doiViTriChuyen({
        lineId: v.id,
        tang: v.tang,
        viTriX: v.x,
        viTriY: v.y,
        rong: v.rong,
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
            : 'Ô xanh là chỗ đã có người hôm nay. Bấm vào một vị trí để vào trang xếp chỗ.'}
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

      {cacTang.map((tang) => (
        <KhungTang
          key={tang}
          tang={tang}
          viTris={cho.filter((v) => v.tang === tang)}
          sapXep={sapXep && duocSapXep}
          dangChay={dangChay}
          keo={(id, x, y) => setCho((ds) => ds.map((v) => (v.id === id ? { ...v, x, y } : v)))}
          thaRa={(id) => {
            const v = cho.find((c) => c.id === id)
            if (v) luuViTri(v)
          }}
          moChuyen={(id) => router.push(`/day-chuyen?dc=${id}`)}
          doiTang={(id, tangMoi) => {
            const v = cho.find((c) => c.id === id)
            if (!v) return
            const moi = { ...v, tang: tangMoi, y: 40 }
            setCho((ds) => ds.map((c) => (c.id === id ? moi : c)))
            luuViTri(moi)
          }}
        />
      ))}

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded bg-emerald-500" />
          có người hôm nay
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-dashed border-slate-400 bg-white" />
          chỗ trống
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded border border-dashed border-amber-400 bg-amber-100" />
          chưa gán nguyên công
        </span>
        <span className="text-slate-300">|</span>
        {(Object.keys(TEN_LOAI) as Loai[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`h-3 w-5 rounded border-2 ${MAU[l].vien} ${MAU[l].nen}`} />
            {TEN_LOAI[l]}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Một ô ghế nhỏ trên mặt bằng. Xanh = có người, vàng = chưa gán nguyên công. */
function OGhe({ g }: { g: Ghe }) {
  const mau = g.nguoi
    ? 'bg-emerald-500 border-emerald-600'
    : g.coNguyenCong
      ? 'border-dashed border-slate-400 bg-white'
      : 'border-dashed border-amber-400 bg-amber-100'

  const chu = g.nguoi
    ? `${g.mat}${g.so} · ${g.nguoi}${g.tenNguyenCong ? ` · ${g.tenNguyenCong}` : ''}`
    : g.coNguyenCong
      ? `${g.mat}${g.so} · trống · ${g.tenNguyenCong}`
      : `${g.mat}${g.so} · chưa gán nguyên công`

  return <span title={chu} className={`h-3 w-3 shrink-0 rounded-[3px] border ${mau}`} />
}

function KhungTang({
  tang,
  viTris,
  sapXep,
  dangChay,
  keo,
  thaRa,
  moChuyen,
  doiTang,
}: {
  tang: number
  viTris: ViTri[]
  sapXep: boolean
  dangChay: boolean
  keo: (id: string, x: number, y: number) => void
  thaRa: (id: string) => void
  moChuyen: (id: string) => void
  doiTang: (id: string, tangMoi: number) => void
}) {
  const khungRef = useRef<HTMLDivElement>(null)
  const dangKeo = useRef<{ id: string; lechX: number; lechY: number } | null>(null)

  const tongGhe = viTris.reduce((a, v) => a + v.ghe.length, 0)
  const tongXep = viTris.reduce((a, v) => a + v.ghe.filter((g) => g.nguoi).length, 0)

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
        className="relative h-[30rem] w-full overflow-auto rounded-2xl border-2 border-slate-300 bg-[linear-gradient(to_right,rgba(148,163,184,.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,.18)_1px,transparent_1px)] bg-[size:2rem_2rem] sm:h-[34rem]"
      >
        {viTris.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-400">
            Tầng này chưa có vị trí sản xuất nào.
            {sapXep
              ? ' Bấm nút chuyển tầng trên một khối ở tầng kia để đưa xuống đây.'
              : ' Bấm “Sắp xếp mặt bằng” rồi dùng nút chuyển tầng trên từng khối.'}
          </p>
        )}

        {viTris.map((v) => {
          const mau = MAU[v.loai]
          const matA = v.ghe.filter((g) => g.mat === 'A')
          const matB = v.ghe.filter((g) => g.mat === 'B')
          const daXep = v.ghe.filter((g) => g.nguoi).length

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
              style={{ left: `${v.x}%`, top: `${v.y}%`, width: `${v.rong}%` }}
              className={[
                'absolute flex flex-col gap-1 rounded-lg border-2 px-2 py-1.5 text-left transition',
                mau.vien,
                mau.nen,
                sapXep
                  ? 'cursor-move touch-none ring-2 ring-brand-200'
                  : 'cursor-pointer hover:shadow-md hover:brightness-[0.97]',
              ].join(' ')}
              title={v.lenh ?? 'Chưa chọn lệnh sản xuất'}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-xs font-semibold leading-tight ${mau.chu}`}>
                  {v.ten}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                  {v.loai === 'MAY' ? TEN_LOAI[v.loai] : `${daXep}/${v.ghe.length}`}
                </span>
              </span>

              {v.lenh && (
                <span className="truncate rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-amber-900">
                  {v.lenh}
                </span>
              )}

              {/* Băng chuyền: hai mặt kẹp băng tải ở giữa, đúng như sơ đồ chỗ ngồi */}
              {v.loai === 'CHUYEN' && v.ghe.length > 0 && (
                <span className="flex flex-col gap-[3px]">
                  <span className="flex flex-wrap gap-[3px]">
                    {matA.map((g) => (
                      <OGhe key={g.id} g={g} />
                    ))}
                  </span>
                  <span className="my-[1px] h-[3px] rounded-full bg-slate-300" />
                  <span className="flex flex-wrap gap-[3px]">
                    {matB.map((g) => (
                      <OGhe key={g.id} g={g} />
                    ))}
                  </span>
                </span>
              )}

              {/* Dãy bàn: một hàng */}
              {v.loai === 'BAN' && v.ghe.length > 0 && (
                <span className="flex flex-wrap gap-[3px]">
                  {v.ghe.map((g) => (
                    <OGhe key={g.id} g={g} />
                  ))}
                </span>
              )}

              {sapXep && (
                <span
                  role="button"
                  tabIndex={-1}
                  title={v.tang === 1 ? 'Đưa lên tầng 2' : 'Đưa xuống tầng 1'}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    doiTang(v.id, v.tang === 1 ? 2 : 1)
                  }}
                  className="absolute right-1 top-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm hover:text-brand-700"
                >
                  {v.tang === 1 ? '↑ Tầng 2' : '↓ Tầng 1'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
