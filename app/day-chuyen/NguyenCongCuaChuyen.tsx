'use client'

import { useMemo, useState, useTransition } from 'react'
import { datNguyenCongChoChuyen } from './actions'

type NC = {
  id: string
  ma: string
  ten: string
  giay: number
  sanPham: string
  boPhan: string
}

/** Bỏ dấu để gõ không dấu vẫn tìm ra. */
function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
}

export default function NguyenCongCuaChuyen({
  tenChuyen,
  tatCa,
  dangChon,
  lineId,
  duocSua,
}: {
  tenChuyen: string
  tatCa: NC[]
  dangChon: string[]
  lineId: string
  duocSua: boolean
}) {
  const [mo, setMo] = useState(false)
  const [chon, setChon] = useState<Set<string>>(new Set(dangChon))
  const [tim, setTim] = useState('')
  const [bao, setBao] = useState<{ loi?: string; ok?: string } | null>(null)
  const [dangChay, batDau] = useTransition()

  const nhom = useMemo(() => {
    const k = khongDau(tim.trim())
    const loc = tatCa.filter(
      (o) => !k || khongDau(o.ten).includes(k) || khongDau(o.ma).includes(k),
    )
    const m = new Map<string, NC[]>()
    for (const o of loc) {
      const khoa = `${o.sanPham} · ${o.boPhan}`
      m.set(khoa, [...(m.get(khoa) ?? []), o])
    }
    return [...m.entries()]
  }, [tatCa, tim])

  function bat(id: string) {
    setChon((cu) => {
      const m = new Set(cu)
      if (m.has(id)) m.delete(id)
      else m.add(id)
      return m
    })
  }

  function batCaNhom(ds: NC[]) {
    const duCa = ds.every((o) => chon.has(o.id))
    setChon((cu) => {
      const m = new Set(cu)
      for (const o of ds) {
        if (duCa) m.delete(o.id)
        else m.add(o.id)
      }
      return m
    })
  }

  function luu() {
    batDau(async () => {
      const kq = await datNguyenCongChoChuyen(lineId, [...chon])
      setBao(kq.loi ? { loi: kq.loi } : { ok: `Đã lưu ${chon.size} nguyên công cho ${tenChuyen}` })
      if (!kq.loi) setMo(false)
    })
  }

  if (!mo) {
    return (
      <div className="the mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            Nguyên công của chuyền{' '}
            <span className="text-sm font-normal text-slate-500">
              ·{' '}
              {dangChon.length === 0
                ? 'chưa giới hạn — ghế chọn được mọi nguyên công của lệnh'
                : `${dangChon.length} nguyên công`}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Giới hạn lại thì tổ trưởng chỉ thấy đúng phần việc của chuyền này khi gán cho ghế.
          </p>
        </div>
        {duocSua && (
          <button onClick={() => setMo(true)} className="nut-phu px-3 py-2 text-sm">
            {dangChon.length === 0 ? 'Chọn nguyên công' : 'Sửa danh sách'}
          </button>
        )}
      </div>
    )
  }

  return (
    <section className="the mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Nguyên công chuyền {tenChuyen} đảm nhận</p>
        <p className="text-sm text-slate-500">đang chọn {chon.size}</p>
      </div>

      {bao?.loi && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{bao.loi}</p>}

      <input
        value={tim}
        onChange={(e) => setTim(e.target.value)}
        placeholder="Tìm nguyên công…"
        className="o-nhap mb-3 w-full py-2 sm:w-72"
      />

      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-slate-200">
        {nhom.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy nguyên công nào.</p>
        ) : (
          nhom.map(([ten, ds]) => {
            const duCa = ds.every((o) => chon.has(o.id))
            return (
              <div key={ten} className="border-b border-slate-100 last:border-0">
                <div className="sticky top-0 flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5">
                  <span className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {ten}
                  </span>
                  <button onClick={() => batCaNhom(ds)} className="shrink-0 text-xs text-brand-700">
                    {duCa ? 'Bỏ cả nhóm' : 'Chọn cả nhóm'}
                  </button>
                </div>
                <ul>
                  {ds.map((o) => (
                    <li key={o.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-brand-50/60">
                        <input
                          type="checkbox"
                          checked={chon.has(o.id)}
                          onChange={() => bat(o.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">{o.ten}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">{o.giay}s</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setChon(new Set())} className="nut-phu px-3 py-2 text-sm">
          Bỏ hết
        </button>
        <span className="flex-1" />
        <button
          onClick={() => {
            setChon(new Set(dangChon))
            setMo(false)
          }}
          className="nut-phu px-3 py-2 text-sm"
        >
          Hủy
        </button>
        <button disabled={dangChay} onClick={luu} className="nut-nho">
          Lưu danh sách
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Bỏ hết rồi lưu = chuyền không bị giới hạn, ghế chọn được mọi nguyên công của lệnh đang chạy.
      </p>
    </section>
  )
}
