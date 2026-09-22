'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { taoDayChuyen } from './actions'

type To = { id: string; name: string }
type Loai = 'CHUYEN' | 'BAN' | 'MAY'

/** Các vị trí sản xuất theo bản vẽ mặt bằng — bấm là điền sẵn, vẫn sửa được. */
const GOI_Y: Array<{ code: string; name: string; soGhe: number; loai: Loai; tang: number }> = [
  { code: 'CT', name: 'Chuyền cải tạo', soGhe: 12, loai: 'CHUYEN', tang: 2 },
  { code: 'LR1', name: 'Chuyền lắp ráp số 1', soGhe: 20, loai: 'CHUYEN', tang: 2 },
  { code: 'LR2', name: 'Chuyền lắp ráp số 2', soGhe: 20, loai: 'CHUYEN', tang: 2 },
  { code: 'MHC', name: 'Máy HC khói', soGhe: 2, loai: 'MAY', tang: 2 },
  { code: 'KKHOI', name: 'Kiểm khói', soGhe: 4, loai: 'BAN', tang: 2 },
  { code: 'KNHIET', name: 'Kiểm nhiệt', soGhe: 4, loai: 'BAN', tang: 2 },
  { code: 'BDK', name: 'Bàn đầu kiểm 1–8', soGhe: 8, loai: 'BAN', tang: 2 },
  { code: 'BG', name: 'Dây chuyền bao gói', soGhe: 10, loai: 'CHUYEN', tang: 1 },
]

export default function ThemDayChuyen({ tos, daCo }: { tos: To[]; daCo: string[] }) {
  const router = useRouter()
  const [mo, setMo] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [soGhe, setSoGhe] = useState('20')
  const [loai, setLoai] = useState<Loai>('CHUYEN')
  const [tang, setTang] = useState('2')
  const [teamId, setTeamId] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  const daCoThuong = daCo.map((d) => d.toLowerCase())
  const con = GOI_Y.filter(
    (g) => !daCoThuong.includes(g.code.toLowerCase()) && !daCoThuong.includes(g.name.toLowerCase()),
  )

  function luu() {
    setLoi(null)
    batDau(async () => {
      const kq = await taoDayChuyen({
        code,
        name,
        soGhe: Number(soGhe),
        loai,
        tang: Number(tang),
        teamId,
      })
      if (kq.loi) {
        setLoi(kq.loi)
        return
      }
      setCode('')
      setName('')
      setMo(false)
      // chu mang id chuyền vừa tạo — mở thẳng chuyền đó ra
      if (kq.chu) router.push(`/day-chuyen?dc=${kq.chu}`)
      router.refresh()
    })
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="chip-tat border-dashed">
        + Thêm chuyền
      </button>
    )
  }

  return (
    <div className="the w-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Thêm vị trí sản xuất</p>
        <button
          type="button"
          onClick={() => {
            setMo(false)
            setLoi(null)
          }}
          className="nut-phu px-2.5 py-1 text-xs"
        >
          Đóng
        </button>
      </div>

      {loi && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{loi}</p>}

      {con.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Điền nhanh theo bản vẽ:</span>
          {con.map((g) => (
            <button
              key={g.code}
              type="button"
              onClick={() => {
                setCode(g.code)
                setName(g.name)
                setSoGhe(String(g.soGhe))
                setLoai(g.loai)
                setTang(String(g.tang))
                setLoi(null)
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
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="o-nhap w-24 py-2 uppercase"
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs text-slate-600">Tên vị trí</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="o-nhap py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Kiểu</span>
          <select
            value={loai}
            onChange={(e) => setLoai(e.target.value as Loai)}
            className="o-chon w-36"
          >
            <option value="CHUYEN">Băng chuyền</option>
            <option value="BAN">Dãy bàn</option>
            <option value="MAY">Máy</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Tầng</span>
          <select value={tang} onChange={(e) => setTang(e.target.value)} className="o-chon w-24">
            <option value="2">Tầng 2</option>
            <option value="1">Tầng 1</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Số chỗ</span>
          <input
            value={soGhe}
            onChange={(e) => setSoGhe(e.target.value)}
            inputMode="numeric"
            className="o-nhap w-20 py-2 text-center"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-600">Tổ phụ trách</span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="o-chon w-44"
          >
            <option value="">— chung —</option>
            {tos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={dangChay} onClick={luu} className="nut-nho">
          {dangChay ? 'Đang tạo…' : 'Tạo vị trí'}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Băng chuyền chia ghế đều hai mặt; dãy bàn và máy xếp một hàng. Vị trí mới được đặt xuống
        dưới cùng của tầng trên sơ đồ mặt bằng, kéo lại sau cho khớp thực tế.
      </p>
    </div>
  )
}
