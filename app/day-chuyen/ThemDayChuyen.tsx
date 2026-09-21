'use client'

import { useState } from 'react'
import { taoDayChuyen } from './actions'

type To = { id: string; name: string }

/** Bốn chuyền hiện có của xưởng — bấm là điền sẵn, vẫn sửa được trước khi tạo. */
const GOI_Y = [
  { code: 'SC', name: 'Chuyền sửa chữa', soGhe: 8 },
  { code: 'G46', name: 'Chuyền G4/G6', soGhe: 20 },
  { code: 'GS06', name: 'Chuyền GS06', soGhe: 20 },
  { code: 'BG', name: 'Chuyền Bao gói', soGhe: 10 },
]

export default function ThemDayChuyen({ tos, daCo }: { tos: To[]; daCo: string[] }) {
  const [mo, setMo] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [soGhe, setSoGhe] = useState('20')

  const con = GOI_Y.filter(
    (g) => !daCo.some((d) => d.toUpperCase() === g.code || d.toLowerCase() === g.name.toLowerCase()),
  )

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="chip-tat border-dashed">
        + Thêm chuyền
      </button>
    )
  }

  return (
    <form
      action={taoDayChuyen}
      className="the w-full"
      onSubmit={() => {
        setMo(false)
        setCode('')
        setName('')
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Thêm dây chuyền</p>
        <button type="button" onClick={() => setMo(false)} className="nut-phu px-2.5 py-1 text-xs">
          Đóng
        </button>
      </div>

      {con.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Điền nhanh:</span>
          {con.map((g) => (
            <button
              key={g.code}
              type="button"
              onClick={() => {
                setCode(g.code)
                setName(g.name)
                setSoGhe(String(g.soGhe))
              }}
              className="chip-tat"
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Mã</span>
          <input
            name="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="o-nhap w-24 py-2 uppercase"
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs text-slate-600">Tên dây chuyền</span>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="o-nhap py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Số ghế</span>
          <input
            name="soGhe"
            value={soGhe}
            onChange={(e) => setSoGhe(e.target.value)}
            inputMode="numeric"
            className="o-nhap w-20 py-2 text-center"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Tổ phụ trách</span>
          <select name="teamId" className="o-chon w-44">
            <option value="">— chung —</option>
            {tos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button className="nut-nho">Tạo dây chuyền</button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Ghế được chia đều hai mặt băng chuyền. Số ghế sửa lại được sau, miễn là ghế bớt đi chưa có ai
        ngồi.
      </p>
    </form>
  )
}
