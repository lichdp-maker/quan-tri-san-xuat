'use client'

import { useMemo, useState, useTransition } from 'react'
import { datNguyenCongChoChuyen } from './actions'

type NC = {
  id: string
  ma: string
  ten: string
  giay: number
  sanPham: string
  maSanPham: string
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

  // Danh sách sản phẩm, giữ đúng thứ tự nguyên công được nạp lên
  const sanPhams = useMemo(() => {
    const m = new Map<string, { ten: string; ma: string; ds: NC[] }>()
    for (const o of tatCa) {
      const cu = m.get(o.sanPham)
      if (cu) cu.ds.push(o)
      else m.set(o.sanPham, { ten: o.sanPham, ma: o.maSanPham, ds: [o] })
    }
    return [...m.values()]
  }, [tatCa])

  const [tab, setTab] = useState(() => sanPhams[0]?.ten ?? '')
  const spDangXem = sanPhams.find((s) => s.ten === tab) ?? sanPhams[0]

  const k = khongDau(tim.trim())
  const hop = (o: NC) => !k || khongDau(o.ten).includes(k) || khongDau(o.ma).includes(k)

  /** Số nguyên công khớp ô tìm, theo từng sản phẩm — để biết nên đổi sang tab nào. */
  const soKhop = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sanPhams) m.set(s.ten, s.ds.filter(hop).length)
    return m
  }, [sanPhams, k])

  /** Số đang chọn theo từng sản phẩm. */
  const soChon = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sanPhams) m.set(s.ten, s.ds.filter((o) => chon.has(o.id)).length)
    return m
  }, [sanPhams, chon])

  /** Nguyên công của tab đang xem, gom theo bộ phận. */
  const theoBoPhan = useMemo(() => {
    if (!spDangXem) return []
    const m = new Map<string, NC[]>()
    for (const o of spDangXem.ds.filter(hop)) {
      m.set(o.boPhan, [...(m.get(o.boPhan) ?? []), o])
    }
    return [...m.entries()]
  }, [spDangXem, k])

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

  // ---------- Thu gọn ----------
  if (!mo) {
    const tomTat = sanPhams
      .filter((s) => (soChon.get(s.ten) ?? 0) > 0)
      .map((s) => `${s.ma} ${soChon.get(s.ten)}`)
      .join(' · ')

    return (
      <div className="the mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            Nguyên công của chuyền{' '}
            <span className="text-sm font-normal text-slate-500">
              ·{' '}
              {dangChon.length === 0
                ? 'chưa giới hạn — ghế chọn được mọi nguyên công của lệnh'
                : `${dangChon.length} nguyên công${tomTat ? ` (${tomTat})` : ''}`}
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

  // ---------- Mở ----------
  return (
    <section className="the mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Nguyên công chuyền {tenChuyen} đảm nhận</p>
        <p className="text-sm text-slate-500">đang chọn {chon.size} nguyên công</p>
      </div>

      {bao?.loi && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{bao.loi}</p>
      )}

      {/* Tab sản phẩm */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {sanPhams.map((s) => {
          const dangXem = s.ten === spDangXem?.ten
          const da = soChon.get(s.ten) ?? 0
          const khop = soKhop.get(s.ten) ?? 0
          return (
            <button
              key={s.ten}
              onClick={() => setTab(s.ten)}
              className={dangXem ? 'chip-bat' : 'chip-tat'}
              title={s.ten}
            >
              {s.ma}
              <span className={dangXem ? 'ml-1.5 opacity-80' : 'ml-1.5 text-slate-400'}>
                {da}/{s.ds.length}
              </span>
              {k && khop > 0 && !dangXem && (
                <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] font-medium text-amber-900">
                  {khop} khớp
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={tim}
          onChange={(e) => setTim(e.target.value)}
          placeholder="Tìm nguyên công…"
          className="o-nhap w-full py-2 sm:w-72"
        />
        {spDangXem && (
          <button
            onClick={() => batCaNhom(spDangXem.ds.filter(hop))}
            className="nut-phu px-3 py-2 text-xs"
          >
            {spDangXem.ds.filter(hop).every((o) => chon.has(o.id))
              ? `Bỏ cả ${spDangXem.ma}`
              : `Chọn cả ${spDangXem.ma}`}
          </button>
        )}
      </div>

      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-slate-200">
        {theoBoPhan.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">
            {k
              ? `Không có nguyên công nào của ${spDangXem?.ma} khớp "${tim}".`
              : 'Sản phẩm này chưa có nguyên công nào.'}
          </p>
        ) : (
          theoBoPhan.map(([boPhan, ds]) => {
            const duCa = ds.every((o) => chon.has(o.id))
            return (
              <div key={boPhan} className="border-b border-slate-100 last:border-0">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5">
                  <span className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {boPhan}
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                      {ds.filter((o) => chon.has(o.id)).length}/{ds.length}
                    </span>
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
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          {o.giay}s
                        </span>
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
          {dangChay ? 'Đang lưu…' : `Lưu ${chon.size} nguyên công`}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Bỏ hết rồi lưu = chuyền không bị giới hạn, ghế chọn được mọi nguyên công của lệnh đang chạy.
      </p>
    </section>
  )
}
