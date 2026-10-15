'use client'

/**
 * Bàn xếp chỗ — màn hình chính của tổ trưởng.
 *
 * Một quy tắc duy nhất cho mọi thao tác: CẦM LÊN rồi ĐẶT XUỐNG.
 *  - Chạm một người ở danh sách  → cầm người đó → chạm chỗ trống để xếp.
 *  - Chạm một người đang ngồi    → cầm người đó → chạm chỗ khác để chuyển
 *                                  (chỗ đó có người thì hai người đổi chỗ).
 *  - Chạm một nguyên công         → cầm nguyên công → chạm lần lượt các chỗ để gán.
 *  - Chạm chỗ trống khi tay không → mở bảng chọn người cho đúng chỗ đó.
 * Trên máy tính kéo-thả cũng ra đúng các thao tác trên.
 *
 * Giao diện cập nhật ngay khi chạm (không chờ máy chủ); máy chủ báo lỗi thì trả lại.
 */

import { useEffect, useMemo, useRef, useState, useTransition, type ComponentProps } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ganNguoiVaoGhe,
  goNguoiKhoiGhe,
  doiCho,
  ganNguyenCongChoGhe,
  chepPhanCong,
  xoaXepNgay,
  type KetQua,
} from './actions'
import ThietLapChuyen, { type Tab } from './ThietLapChuyen'
import { themNgay, nhanNgay, cachNgay, SO_NGAY_TOI_DA } from '@/lib/ngay-xep'

/* ------------------------------------------------------------------ */
/* Kiểu dữ liệu                                                        */
/* ------------------------------------------------------------------ */

export type Ghe = {
  id: string
  mat: 'A' | 'B'
  so: number
  ncId: string | null
  ncTen: string | null
  ncGiay: number | null
  nguoi: { id: string; ma: string; ten: string; daNhap: boolean } | null
}

export type CongNhan = {
  id: string
  ma: string
  ten: string
  to: string
  /** Chỗ người này đang giữ ở CHUYỀN KHÁC trong ngày, dạng "Chuyền GS06 A3". */
  noiKhac: string[]
}

export type NguyenCong = { id: string; ten: string; boPhan: string; giay: number }


type Cam =
  | { loai: 'nguoi'; id: string; ten: string }
  | { loai: 'cho'; seatId: string; id: string; ten: string }
  | { loai: 'nc'; id: string | null; ten: string; giay: number | null }
  | null

type CheDo = 'xep' | 'nc'

/* ------------------------------------------------------------------ */

function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function ngayDai(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

function tenGon(ten: string) {
  // "Nguyễn Thị Thu Hà" -> "Thu Hà" khi thẻ chật; giữ đủ trong title
  const p = ten.trim().split(/\s+/)
  return p.length > 2 ? p.slice(-2).join(' ') : ten
}

/* ------------------------------------------------------------------ */

export default function BanXepCho({
  ymd,
  homNay,
  chiXem,
  lineId,
  tenChuyen,
  loai,
  coLenh,
  dongLenh,
  ghe,
  congNhan,
  nguyenCongs,
  toMacDinh,
  homTruoc,
  caiDat,
}: {
  ymd: string
  homNay: string
  chiXem: boolean
  lineId: string
  tenChuyen: string
  loai: string
  coLenh: boolean
  /** Một dòng mô tả lệnh đang chạy, null = chưa chọn lệnh/ca */
  dongLenh: { sanPham: string; chiTiet: string; pct: number } | null
  ghe: Ghe[]
  congNhan: CongNhan[]
  nguyenCongs: NguyenCong[]
  toMacDinh: string | null
  homTruoc: { ymd: string; soNguoi: number } | null
  caiDat: Omit<ComponentProps<typeof ThietLapChuyen>, 'tab' | 'setTab'>
}) {
  const router = useRouter()
  const [cho, setCho] = useState<Ghe[]>(ghe)
  useEffect(() => setCho(ghe), [ghe])

  const [cheDo, setCheDo] = useState<CheDo>('xep')
  const [cam, setCam] = useState<Cam>(null)
  const [lienTuc, setLienTuc] = useState(false)
  const [moChoId, setMoChoId] = useState<string | null>(null)
  const [tabCaiDat, setTabCaiDat] = useState<Tab | null>(null)
  const [moChep, setMoChep] = useState(false)
  const [moSheet, setMoSheet] = useState(false)
  const [gheSang, setGheSang] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<{ loai: 'loi' | 'ok'; chu: string } | null>(null)
  const [, batDau] = useTransition()

  /* ---------- Thông báo tự tắt ---------- */
  useEffect(() => {
    if (!thongBao) return
    const t = setTimeout(() => setThongBao(null), thongBao.loai === 'loi' ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [thongBao])

  /* ---------- Esc để bỏ cầm ---------- */
  useEffect(() => {
    function phim(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (moChoId) setMoChoId(null)
      else setCam(null)
    }
    window.addEventListener('keydown', phim)
    return () => window.removeEventListener('keydown', phim)
  }, [moChoId])

  /* ---------- Số liệu suy ra ---------- */
  const choCuaNguoi = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const g of cho) {
      if (!g.nguoi) continue
      m.set(g.nguoi.id, [...(m.get(g.nguoi.id) ?? []), `${g.mat}${g.so}`])
    }
    return m
  }, [cho])

  const coNguoi = cho.filter((g) => g.nguoi).length
  const choTrong = cho.filter((g) => !g.nguoi && g.ncId).length
  const chuaNC = cho.filter((g) => !g.ncId).length

  const soViec = (id: string) =>
    (choCuaNguoi.get(id)?.length ?? 0) + (congNhan.find((c) => c.id === id)?.noiKhac.length ?? 0)

  /* ---------- Chạy một thao tác: cập nhật ngay, máy chủ lỗi thì trả lại ---------- */
  function chay(doi: (ds: Ghe[]) => Ghe[], viec: () => Promise<KetQua>) {
    if (chiXem) return
    const truoc = cho
    setCho(doi)
    batDau(async () => {
      try {
        const kq = await viec()
        if (kq.loi) {
          setCho(truoc)
          setThongBao({ loai: 'loi', chu: kq.loi })
        } else if (kq.chu) {
          setThongBao({ loai: 'ok', chu: kq.chu })
        }
      } catch {
        setCho(truoc)
        setThongBao({ loai: 'loi', chu: 'Mất kết nối tới máy chủ — thao tác chưa được lưu.' })
      }
    })
  }

  const congNhanTheoId = useMemo(() => new Map(congNhan.map((c) => [c.id, c])), [congNhan])

  function xepNguoi(seatId: string, userId: string) {
    const c = congNhanTheoId.get(userId)
    if (!c) return
    chay(
      (ds) =>
        ds.map((g) =>
          g.id === seatId ? { ...g, nguoi: { id: c.id, ma: c.ma, ten: c.ten, daNhap: false } } : g,
        ),
      () => ganNguoiVaoGhe(seatId, userId, ymd),
    )
  }

  function chuyenCho(tuId: string, denId: string) {
    if (tuId === denId) return
    chay(
      (ds) => {
        const a = ds.find((g) => g.id === tuId)?.nguoi ?? null
        const b = ds.find((g) => g.id === denId)?.nguoi ?? null
        return ds.map((g) => (g.id === denId ? { ...g, nguoi: a } : g.id === tuId ? { ...g, nguoi: b } : g))
      },
      () => doiCho(tuId, denId, ymd),
    )
  }

  function goNguoi(seatId: string) {
    chay(
      (ds) => ds.map((g) => (g.id === seatId ? { ...g, nguoi: null } : g)),
      () => goNguoiKhoiGhe(seatId, ymd),
    )
  }

  function ganNC(seatId: string, nc: { id: string | null; ten: string; giay: number | null }) {
    chay(
      (ds) =>
        ds.map((g) =>
          g.id === seatId
            ? {
                ...g,
                ncId: nc.id,
                ncTen: nc.id ? nc.ten : null,
                ncGiay: nc.id ? nc.giay : null,
                nguoi: nc.id ? g.nguoi : null,
              }
            : g,
        ),
      () => ganNguyenCongChoGhe(seatId, nc.id ?? ''),
    )
  }

  /* ---------- Danh sách người, chia nhóm ---------- */
  const dsTo = useMemo(() => [...new Set(congNhan.map((c) => c.to))].sort(), [congNhan])
  const [locTo, setLocTo] = useState<string>(
    toMacDinh && congNhan.some((c) => c.to === toMacDinh) ? toMacDinh : '',
  )
  const [tim, setTim] = useState('')
  const k = khongDau(tim.trim())

  const hop = (c: CongNhan) =>
    (!locTo || c.to === locTo) && (!k || khongDau(c.ten).includes(k) || khongDau(c.ma).includes(k))

  const chuaCoCho = congNhan.filter((c) => !choCuaNguoi.has(c.id) && c.noiKhac.length === 0 && hop(c))
  const oChuyenKhac = congNhan.filter((c) => !choCuaNguoi.has(c.id) && c.noiKhac.length > 0 && hop(c))
  const daOday = congNhan.filter((c) => choCuaNguoi.has(c.id) && hop(c))

  const tongChuaCoCho = congNhan.filter((c) => !choCuaNguoi.has(c.id) && c.noiKhac.length === 0).length

  /* ---------- Chạm vào một chỗ ---------- */
  function bamCho(g: Ghe) {
    if (chiXem) return

    if (cheDo === 'nc') {
      if (cam?.loai === 'nc') ganNC(g.id, cam)
      else setThongBao({ loai: 'loi', chu: 'Chọn một nguyên công ở danh sách trước, rồi chạm vào các chỗ để gán.' })
      return
    }

    if (!cam) {
      if (g.nguoi) setCam({ loai: 'cho', seatId: g.id, id: g.nguoi.id, ten: g.nguoi.ten })
      else setMoChoId(g.id)
      return
    }

    if (cam.loai === 'cho') {
      if (cam.seatId !== g.id) chuyenCho(cam.seatId, g.id)
      setCam(null)
      return
    }

    if (cam.loai === 'nguoi') {
      if (!g.ncId) {
        setThongBao({ loai: 'loi', chu: `Chỗ ${g.mat}${g.so} chưa gán nguyên công — chuyển sang “Gán nguyên công” để gán trước.` })
        return
      }
      xepNguoi(g.id, cam.id)
      if (lienTuc) {
        const keTiep = chuaCoCho.find((c) => c.id !== cam.id)
        setCam(keTiep ? { loai: 'nguoi', id: keTiep.id, ten: keTiep.ten } : null)
      } else {
        setCam(null)
      }
    }
  }

  /* ---------- Kéo thả (máy tính) ---------- */
  function thaVaoCho(e: React.DragEvent, g: Ghe) {
    e.preventDefault()
    setGheSang(null)
    try {
      const d = JSON.parse(e.dataTransfer.getData('text/plain')) as Cam
      if (!d) return
      if (d.loai === 'nguoi') {
        if (!g.ncId) {
          setThongBao({ loai: 'loi', chu: `Chỗ ${g.mat}${g.so} chưa gán nguyên công.` })
          return
        }
        xepNguoi(g.id, d.id)
      } else if (d.loai === 'cho') chuyenCho(d.seatId, g.id)
      else if (d.loai === 'nc') ganNC(g.id, d)
    } catch {
      /* dữ liệu kéo không phải của trang này */
    }
    setCam(null)
  }

  function thaVaoDanhSach(e: React.DragEvent) {
    e.preventDefault()
    try {
      const d = JSON.parse(e.dataTransfer.getData('text/plain')) as Cam
      if (d?.loai === 'cho') goNguoi(d.seatId)
    } catch {
      /* bỏ qua */
    }
    setCam(null)
  }

  /* ---------- Điều hướng ngày / chuyền ---------- */
  function diNgay(moi: string) {
    const lech = cachNgay(homNay, moi)
    if (lech < -30 || lech > SO_NGAY_TOI_DA) return
    setCam(null)
    router.push(`/day-chuyen?dc=${lineId}&ngay=${moi}`)
  }

  /* ---------- Chép / gỡ hết ---------- */
  const [dangChep, batDauChep] = useTransition()
  function chepTu(tuNgay: string, caXuong: boolean, ghiDe: boolean) {
    batDauChep(async () => {
      const kq = await chepPhanCong({ tuNgay, denNgay: ymd, lineId: caXuong ? undefined : lineId, ghiDe })
      setThongBao(kq.loi ? { loai: 'loi', chu: kq.loi } : { loai: 'ok', chu: kq.chu ?? 'Đã chép xong.' })
      if (!kq.loi) {
        setMoChep(false)
        router.refresh()
      }
    })
  }

  const [xacNhanGo, setXacNhanGo] = useState(false)
  useEffect(() => {
    if (!xacNhanGo) return
    const t = setTimeout(() => setXacNhanGo(false), 4000)
    return () => clearTimeout(t)
  }, [xacNhanGo])

  function goHet() {
    if (!xacNhanGo) {
      setXacNhanGo(true)
      return
    }
    setXacNhanGo(false)
    chay(
      (ds) => ds.map((g) => (g.nguoi && !g.nguoi.daNhap ? { ...g, nguoi: null } : g)),
      () => xoaXepNgay(lineId, ymd),
    )
  }

  /* ---------- Bố cục ---------- */
  const matA = cho.filter((g) => g.mat === 'A')
  const matB = cho.filter((g) => g.mat === 'B')
  const lech = cachNgay(homNay, ymd)
  const gheDangMo = cho.find((g) => g.id === moChoId) ?? null

  const demNC = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of cho) if (g.ncId) m.set(g.ncId, (m.get(g.ncId) ?? 0) + 1)
    return m
  }, [cho])

  return (
    <div className="pb-28 lg:pb-0">
      {/* ================= THANH TRÊN: QUAY LẠI + TÊN CHUYỀN + NGÀY ================= */}
      <div className="the mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/day-chuyen?ngay=${ymd}`} className="nut-phu shrink-0">
            ← Tất cả chuyền
          </Link>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight">{tenChuyen}</h2>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50">
            <button
              onClick={() => diNgay(themNgay(ymd, -1))}
              aria-label="Ngày trước"
              className="px-3 py-2 text-slate-500 hover:text-slate-900"
            >
              ◀
            </button>
            <label className="relative cursor-pointer px-1 py-1.5 text-center">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {nhanNgay(ymd, homNay)}
              </span>
              <span className="block text-sm font-bold leading-tight">{ngayDai(ymd)}</span>
              <input
                type="date"
                value={ymd}
                min={themNgay(homNay, -30)}
                max={themNgay(homNay, SO_NGAY_TOI_DA)}
                onChange={(e) => e.target.value && diNgay(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Chọn ngày"
              />
            </label>
            <button
              onClick={() => diNgay(themNgay(ymd, 1))}
              aria-label="Ngày sau"
              className="px-3 py-2 text-slate-500 hover:text-slate-900"
            >
              ▶
            </button>
          </div>
          {lech !== 0 && (
            <button onClick={() => diNgay(homNay)} className="chip-tat">
              Về hôm nay
            </button>
          )}
          {lech !== 1 && (
            <button onClick={() => diNgay(themNgay(homNay, 1))} className="chip-tat">
              Ngày mai
            </button>
          )}
        </div>

        {/* Lệnh đang chạy */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {dongLenh ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">
                {dongLenh.sanPham}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-brand-600" style={{ width: `${dongLenh.pct}%` }} />
                </span>
                <span className="truncate text-xs text-slate-500">{dongLenh.chiTiet}</span>
              </div>
            </div>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-amber-800">
              Chuyền chưa chọn lệnh sản xuất hoặc ca — chưa xếp người được.
            </p>
          )}
          <button
            onClick={() => setTabCaiDat('lenh')}
            className={dongLenh ? 'nut-phu shrink-0' : 'nut-nho shrink-0'}
          >
            {dongLenh ? '⚙ Cài đặt chuyền' : 'Chọn lệnh và ca'}
          </button>
        </div>
      </div>

      {/* ================= THANH TRẠNG THÁI + CÔNG CỤ ================= */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 text-sm">
          <button
            onClick={() => {
              setCheDo('xep')
              setCam(null)
            }}
            className={`rounded-lg px-3 py-1.5 font-medium ${cheDo === 'xep' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            Xếp người
          </button>
          <button
            onClick={() => {
              setCheDo('nc')
              setCam(null)
            }}
            className={`rounded-lg px-3 py-1.5 font-medium ${cheDo === 'nc' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            Gán nguyên công
          </button>
        </div>

        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            <strong className="tabular-nums">{coNguoi}</strong>
            <span className="text-slate-500">/{cho.length} có người</span>
          </span>
          {choTrong > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-400" />
              <strong className="tabular-nums">{choTrong}</strong>
              <span className="text-slate-500">trống</span>
            </span>
          )}
          {chuaNC > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-300" />
              <strong className="tabular-nums">{chuaNC}</strong>
              <span className="text-slate-500">chưa gán NC</span>
            </span>
          )}
        </span>

        <span className="flex-1" />

        {!chiXem && (
          <>
            <button onClick={() => setMoChep((v) => !v)} className="nut-phu">
              ⧉ Chép từ ngày khác
            </button>
            {coNguoi > 0 && (
              <button
                onClick={goHet}
                className={
                  xacNhanGo
                    ? 'rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white'
                    : 'nut-phu text-red-600'
                }
              >
                {xacNhanGo ? `Bấm lần nữa để gỡ ${coNguoi} người` : 'Gỡ hết'}
              </button>
            )}
          </>
        )}
      </div>

      {chiXem && (
        <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ngày đã qua — chỉ xem lại, không sửa được chỗ ngồi.
        </p>
      )}

      {/* Gợi ý chép khi ngày còn trống */}
      {!chiXem && coNguoi === 0 && homTruoc && homTruoc.soNguoi > 0 && coLenh && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-900">
            Ngày {ngayDai(ymd)} <strong>{tenChuyen}</strong> chưa xếp ai. Ngày {ngayDai(homTruoc.ymd)} có{' '}
            <strong>{homTruoc.soNguoi} người</strong> — chép y nguyên rồi chỉnh vài chỗ là xong.
          </p>
          <button disabled={dangChep} onClick={() => chepTu(homTruoc.ymd, false, false)} className="nut-nho shrink-0">
            {dangChep ? 'Đang chép…' : `Chép y như ${ngayDai(homTruoc.ymd).slice(0, 5)}`}
          </button>
        </div>
      )}

      {moChep && <BangChep ymd={ymd} homNay={homNay} tenChuyen={tenChuyen} dangChep={dangChep} chep={chepTu} dong={() => setMoChep(false)} />}

      {/* ================= BÀN XẾP ================= */}
      <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-4">
        {/* ----- Danh sách bên trái (trên điện thoại: ngăn kéo dưới đáy) ----- */}
        <aside
          onDragOver={(e) => e.preventDefault()}
          onDrop={thaVaoDanhSach}
          className={[
            'fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-12px_32px_-12px_rgba(15,23,42,0.25)]',
            moSheet ? 'max-h-[60dvh]' : 'max-h-[3.75rem]',
            // Màn hình rộng: thành cột trái dính theo khi cuộn
            'lg:sticky lg:inset-auto lg:top-3 lg:z-0 lg:max-h-[calc(100dvh-1.5rem)] lg:self-start lg:rounded-2xl lg:border lg:shadow-none',
          ].join(' ')}
        >
          <button
            onClick={() => setMoSheet((v) => !v)}
            className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-left lg:pointer-events-none"
          >
            <span className="font-semibold">
              {cheDo === 'xep' ? (
                <>
                  Chưa có chỗ{' '}
                  <span className={tongChuaCoCho > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {tongChuaCoCho}
                  </span>
                  <span className="font-normal text-slate-400"> / {congNhan.length} người</span>
                </>
              ) : (
                <>Nguyên công của lệnh</>
              )}
            </span>
            <span className="text-slate-400 lg:hidden">{moSheet ? '▼' : '▲'}</span>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {cheDo === 'xep' ? (
              <>
                <input
                  value={tim}
                  onChange={(e) => setTim(e.target.value)}
                  placeholder="Tìm tên hoặc mã…"
                  className="o-nhap mb-2 w-full py-2"
                />
                {dsTo.length > 1 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    <button onClick={() => setLocTo('')} className={locTo === '' ? 'chip-bat' : 'chip-tat'}>
                      Mọi tổ
                    </button>
                    {dsTo.map((t) => (
                      <button key={t} onClick={() => setLocTo(locTo === t ? '' : t)} className={locTo === t ? 'chip-bat' : 'chip-tat'}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {!chiXem && (
                  <label className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={lienTuc} onChange={(e) => setLienTuc(e.target.checked)} />
                    Xếp liên tục — xếp xong tự cầm người kế tiếp
                  </label>
                )}

                <NhomNguoi
                  tieuDe="Chưa có chỗ"
                  ds={chuaCoCho}
                  rong="Ai cũng đã có chỗ."
                  cam={cam}
                  chiXem={chiXem}
                  chon={(c) => {
                    setCam(cam?.loai === 'nguoi' && cam.id === c.id ? null : { loai: 'nguoi', id: c.id, ten: c.ten })
                    setMoSheet(false)
                  }}
                />
                {oChuyenKhac.length > 0 && (
                  <NhomNguoi
                    tieuDe="Đang ở chuyền khác"
                    ds={oChuyenKhac}
                    cam={cam}
                    chiXem={chiXem}
                    mo={false}
                    chon={(c) => {
                      setCam({ loai: 'nguoi', id: c.id, ten: c.ten })
                      setMoSheet(false)
                    }}
                  />
                )}
                {daOday.length > 0 && (
                  <NhomNguoi
                    tieuDe="Đã xếp ở chuyền này"
                    ds={daOday}
                    phu={(c) => `ở ${choCuaNguoi.get(c.id)?.join(', ')}`}
                    cam={cam}
                    chiXem={chiXem}
                    mo={false}
                    chon={(c) => {
                      setCam({ loai: 'nguoi', id: c.id, ten: c.ten })
                      setMoSheet(false)
                    }}
                  />
                )}
                {!chiXem && (
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    Kéo người đang ngồi thả vào khung này để gỡ khỏi chỗ.
                  </p>
                )}
              </>
            ) : (
              <DanhSachNC
                ds={nguyenCongs}
                dem={demNC}
                cam={cam}
                coLenh={coLenh}
                moCaiDat={() => setTabCaiDat('lenh')}
                chon={(nc) => {
                  setCam(cam?.loai === 'nc' && cam.id === nc.id ? null : { loai: 'nc', ...nc })
                  setMoSheet(false)
                }}
              />
            )}
          </div>
        </aside>

        {/* ----- Sơ đồ chuyền ----- */}
        <section className="min-w-0">
          {cam && (
            <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-600 px-4 py-2.5 text-white shadow-[0_12px_28px_-12px_rgba(37,99,235,0.95)]">
              <p className="min-w-0 text-sm">
                {cam.loai === 'nguoi' && (
                  <>
                    Đang cầm <strong>{cam.ten}</strong> — chạm vào một chỗ để xếp
                    {soViec(cam.id) > 0 && <span className="opacity-80"> (đây sẽ là việc thứ {soViec(cam.id) + 1})</span>}
                  </>
                )}
                {cam.loai === 'cho' && (
                  <>
                    Đang chuyển <strong>{cam.ten}</strong> — chạm chỗ khác để chuyển, chỗ có người thì hai người đổi
                    chỗ
                  </>
                )}
                {cam.loai === 'nc' && (
                  <>
                    Đang gán <strong>{cam.ten}</strong> — chạm lần lượt các chỗ cần gán
                  </>
                )}
              </p>
              <span className="flex shrink-0 gap-1.5">
                {cam.loai === 'cho' && (
                  <button
                    onClick={() => {
                      goNguoi(cam.seatId)
                      setCam(null)
                    }}
                    className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium hover:bg-white/25"
                  >
                    Gỡ khỏi chỗ
                  </button>
                )}
                <button
                  onClick={() => setCam(null)}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-brand-700"
                >
                  {cam.loai === 'nc' ? 'Xong' : 'Bỏ'}
                </button>
              </span>
            </div>
          )}

          <div className="the">
            {loai === 'CHUYEN' ? (
              <>
                <HangCho
                  nhan="Mặt A"
                  ds={matA}
                  {...{ cam, cheDo, gheSang, setGheSang, bamCho, thaVaoCho, chiXem, soViec }}
                />
                <div className="my-3 flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Băng chuyền</span>
                  <span className="flex-1 border-t-2 border-dashed border-slate-400/70" />
                  <span className="truncate text-xs text-slate-600">{dongLenh ? `${dongLenh.sanPham} →` : '→'}</span>
                </div>
                <HangCho
                  nhan="Mặt B"
                  ds={matB}
                  {...{ cam, cheDo, gheSang, setGheSang, bamCho, thaVaoCho, chiXem, soViec }}
                />
              </>
            ) : (
              <HangCho
                nhan={loai === 'MAY' ? 'Vị trí máy' : 'Dãy bàn'}
                ds={cho}
                {...{ cam, cheDo, gheSang, setGheSang, bamCho, thaVaoCho, chiXem, soViec }}
              />
            )}

            {cho.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                Chuyền này chưa có chỗ ngồi nào. Vào ⚙ Cài đặt chuyền → Thông tin chuyền để đặt số chỗ.
              </p>
            )}
          </div>

          <p className="mt-2 hidden text-xs text-slate-400 lg:block">
            Chạm người → chạm chỗ để xếp · Chạm người đang ngồi → chạm chỗ khác để chuyển/đổi · Kéo thả cũng được ·
            Esc để bỏ cầm
          </p>
        </section>
      </div>

      {/* ================= HỘP THOẠI ================= */}
      {gheDangMo && (
        <BangChonNguoi
          g={gheDangMo}
          chuaCoCho={congNhan.filter((c) => !choCuaNguoi.has(c.id) && c.noiKhac.length === 0)}
          khac={congNhan.filter((c) => choCuaNguoi.has(c.id) || c.noiKhac.length > 0)}
          nguyenCongs={nguyenCongs}
          coLenh={coLenh}
          dong={() => setMoChoId(null)}
          xep={(userId) => {
            xepNguoi(gheDangMo.id, userId)
            setMoChoId(null)
          }}
          ganNC={(nc) => ganNC(gheDangMo.id, nc)}
          moCaiDat={() => {
            setMoChoId(null)
            setTabCaiDat('lenh')
          }}
        />
      )}

      <ThietLapChuyen {...caiDat} tab={tabCaiDat} setTab={setTabCaiDat} />

      {thongBao && (
        <div
          role="status"
          className={`fixed left-1/2 top-4 z-[60] w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm shadow-lg ${
            thongBao.loai === 'loi' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
          }`}
          onClick={() => setThongBao(null)}
        >
          {thongBao.chu}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Một mặt chuyền                                                      */
/* ------------------------------------------------------------------ */

function HangCho({
  nhan,
  ds,
  cam,
  cheDo,
  gheSang,
  setGheSang,
  bamCho,
  thaVaoCho,
  chiXem,
  soViec,
}: {
  nhan: string
  ds: Ghe[]
  cam: Cam
  cheDo: CheDo
  gheSang: string | null
  setGheSang: (id: string | null) => void
  bamCho: (g: Ghe) => void
  thaVaoCho: (e: React.DragEvent, g: Ghe) => void
  chiXem: boolean
  soViec: (id: string) => number
}) {
  if (ds.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {nhan} <span className="font-normal normal-case tracking-normal">· {ds.length} chỗ</span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
        {ds.map((g) => (
          <OCho
            key={g.id}
            g={g}
            cam={cam}
            cheDo={cheDo}
            sang={gheSang === g.id}
            setGheSang={setGheSang}
            bam={() => bamCho(g)}
            tha={(e) => thaVaoCho(e, g)}
            chiXem={chiXem}
            soViec={g.nguoi ? soViec(g.nguoi.id) : 0}
          />
        ))}
      </div>
    </div>
  )
}

function OCho({
  g,
  cam,
  cheDo,
  sang,
  setGheSang,
  bam,
  tha,
  chiXem,
  soViec,
}: {
  g: Ghe
  cam: Cam
  cheDo: CheDo
  sang: boolean
  setGheSang: (id: string | null) => void
  bam: () => void
  tha: (e: React.DragEvent) => void
  chiXem: boolean
  soViec: number
}) {
  const dangCamCho = cam?.loai === 'cho' && cam.seatId === g.id
  const nhanDuoc =
    !chiXem &&
    ((cam?.loai === 'nguoi' && !!g.ncId) || (cam?.loai === 'cho' && !dangCamCho) || cam?.loai === 'nc')
  const mo = !!cam && !nhanDuoc && !dangCamCho

  const nen = g.nguoi
    ? 'border-emerald-300 bg-emerald-50'
    : g.ncId
      ? 'border-dashed border-slate-300 bg-white'
      : 'border-dashed border-amber-300 bg-amber-50/70'

  return (
    <button
      type="button"
      onClick={bam}
      onDragOver={(e) => {
        if (chiXem) return
        e.preventDefault()
        setGheSang(g.id)
      }}
      onDragLeave={() => setGheSang(null)}
      onDrop={tha}
      className={[
        'relative flex min-h-[6.5rem] flex-col gap-1 rounded-xl border-2 p-2 text-left transition',
        nen,
        sang ? 'border-brand-500 ring-4 ring-brand-100' : '',
        dangCamCho ? 'border-brand-600 ring-4 ring-brand-200' : '',
        nhanDuoc ? 'ring-2 ring-brand-300 hover:border-brand-500 hover:bg-brand-50' : '',
        mo ? 'opacity-40' : '',
        chiXem ? 'cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {g.mat}
          {g.so}
        </span>
        {g.ncGiay !== null && <span className="text-[10px] tabular-nums text-slate-400">{g.ncGiay}s</span>}
      </span>

      <span
        className={[
          'line-clamp-2 text-[11px] leading-tight',
          g.ncTen ? (cheDo === 'nc' ? 'font-semibold text-slate-800' : 'text-slate-500') : 'font-medium text-amber-700',
        ].join(' ')}
        title={g.ncTen ?? undefined}
      >
        {g.ncTen ?? 'Chưa gán nguyên công'}
      </span>

      {g.nguoi ? (
        <span
          draggable={!chiXem && !g.nguoi.daNhap}
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.setData(
              'text/plain',
              JSON.stringify({ loai: 'cho', seatId: g.id, id: g.nguoi!.id, ten: g.nguoi!.ten }),
            )
          }}
          className="mt-auto block rounded-lg bg-white px-2 py-1.5 shadow-sm"
          title={`${g.nguoi.ten} · ${g.nguoi.ma}`}
        >
          <span className="block truncate text-[13px] font-semibold leading-tight">{tenGon(g.nguoi.ten)}</span>
          <span className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
            <span className="truncate">{g.nguoi.ma}</span>
            {soViec > 1 && <span className="shrink-0 rounded bg-amber-100 px-1 font-medium text-amber-800">{soViec} việc</span>}
            {g.nguoi.daNhap && <span className="shrink-0 text-emerald-700">✓ đã nhập</span>}
          </span>
        </span>
      ) : (
        <span
          className={[
            'mt-auto block rounded-lg border border-dashed px-2 py-2 text-center text-[11px]',
            nhanDuoc ? 'border-brand-400 bg-brand-50 font-medium text-brand-700' : 'border-slate-300 text-slate-400',
          ].join(' ')}
        >
          {chiXem ? '—' : nhanDuoc ? 'Chạm để đặt vào' : g.ncId ? '+ Xếp người' : 'Gán NC trước'}
        </span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Danh sách người                                                     */
/* ------------------------------------------------------------------ */

function NhomNguoi({
  tieuDe,
  ds,
  rong,
  phu,
  cam,
  chiXem,
  chon,
  mo: moMacDinh = true,
}: {
  tieuDe: string
  ds: CongNhan[]
  rong?: string
  phu?: (c: CongNhan) => string
  cam: Cam
  chiXem: boolean
  chon: (c: CongNhan) => void
  mo?: boolean
}) {
  const [mo, setMo] = useState(moMacDinh)
  return (
    <div className="mt-2">
      <button
        onClick={() => setMo((v) => !v)}
        className="flex w-full items-center justify-between py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
      >
        <span>
          {tieuDe} · {ds.length}
        </span>
        <span>{mo ? '−' : '+'}</span>
      </button>
      {mo &&
        (ds.length === 0 ? (
          rong ? <p className="py-2 text-sm text-emerald-700">{rong}</p> : null
        ) : (
          <ul className="flex flex-col gap-1">
            {ds.map((c) => {
              const dang = cam?.loai === 'nguoi' && cam.id === c.id
              return (
                <li key={c.id}>
                  <button
                    disabled={chiXem}
                    draggable={!chiXem}
                    onDragStart={(e) =>
                      e.dataTransfer.setData('text/plain', JSON.stringify({ loai: 'nguoi', id: c.id, ten: c.ten }))
                    }
                    onClick={() => chon(c)}
                    className={[
                      'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition',
                      dang
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'cursor-grab border-slate-200 bg-white hover:border-brand-400',
                    ].join(' ')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium leading-tight">{c.ten}</span>
                      <span className={`block truncate text-[11px] ${dang ? 'text-white/80' : 'text-slate-400'}`}>
                        {c.ma} · {c.to}
                      </span>
                      {(phu || c.noiKhac.length > 0) && (
                        <span className={`block truncate text-[11px] ${dang ? 'text-white/85' : 'text-amber-700'}`}>
                          {phu ? phu(c) : `đang ở ${c.noiKhac.join(', ')}`}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ))}
    </div>
  )
}

function DanhSachNC({
  ds,
  dem,
  cam,
  coLenh,
  chon,
  moCaiDat,
}: {
  ds: NguyenCong[]
  dem: Map<string, number>
  cam: Cam
  coLenh: boolean
  chon: (nc: { id: string | null; ten: string; giay: number | null }) => void
  moCaiDat: () => void
}) {
  if (!coLenh) {
    return (
      <div className="py-3 text-sm text-slate-600">
        <p>Chưa chọn lệnh sản xuất nên chưa có nguyên công để gán.</p>
        <button onClick={moCaiDat} className="nut-nho mt-2">
          Chọn lệnh và ca
        </button>
      </div>
    )
  }
  const theoBoPhan = new Map<string, NguyenCong[]>()
  for (const nc of ds) theoBoPhan.set(nc.boPhan, [...(theoBoPhan.get(nc.boPhan) ?? []), nc])

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">Chọn một nguyên công, rồi chạm lần lượt các chỗ trên chuyền để gán.</p>
      {[...theoBoPhan.entries()].map(([bp, dsBP]) => (
        <div key={bp}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{bp}</p>
          <ul className="flex flex-col gap-1">
            {dsBP.map((nc) => {
              const dang = cam?.loai === 'nc' && cam.id === nc.id
              const so = dem.get(nc.id) ?? 0
              return (
                <li key={nc.id}>
                  <button
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        'text/plain',
                        JSON.stringify({ loai: 'nc', id: nc.id, ten: nc.ten, giay: nc.giay }),
                      )
                    }
                    onClick={() => chon({ id: nc.id, ten: nc.ten, giay: nc.giay })}
                    className={[
                      'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm',
                      dang ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white hover:border-brand-400',
                    ].join(' ')}
                  >
                    <span className="min-w-0 flex-1 truncate">{nc.ten}</span>
                    <span className={`shrink-0 text-xs tabular-nums ${dang ? 'text-white/80' : 'text-slate-400'}`}>
                      {nc.giay}s
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 text-[11px] font-semibold tabular-nums ${
                        so > 0 ? (dang ? 'bg-white/20' : 'bg-emerald-100 text-emerald-800') : dang ? 'bg-white/20' : 'bg-slate-100 text-slate-400'
                      }`}
                      title="Số chỗ đang làm nguyên công này"
                    >
                      {so}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <button
        onClick={() => chon({ id: null, ten: 'Bỏ nguyên công', giay: null })}
        className={`mt-1 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-sm ${
          cam?.loai === 'nc' && cam.id === null ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300 text-slate-500'
        }`}
      >
        Bỏ nguyên công khỏi chỗ (gỡ luôn người đang ngồi)
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bảng chọn người cho một chỗ trống                                   */
/* ------------------------------------------------------------------ */

function BangChonNguoi({
  g,
  chuaCoCho,
  khac,
  nguyenCongs,
  coLenh,
  dong,
  xep,
  ganNC,
  moCaiDat,
}: {
  g: Ghe
  chuaCoCho: CongNhan[]
  khac: CongNhan[]
  nguyenCongs: NguyenCong[]
  coLenh: boolean
  dong: () => void
  xep: (userId: string) => void
  ganNC: (nc: { id: string | null; ten: string; giay: number | null }) => void
  moCaiDat: () => void
}) {
  const [tim, setTim] = useState('')
  const [doiNC, setDoiNC] = useState(!g.ncId)
  const oTim = useRef<HTMLInputElement>(null)
  const k = khongDau(tim.trim())
  const hop = (c: CongNhan) => !k || khongDau(c.ten).includes(k) || khongDau(c.ma).includes(k)

  useEffect(() => {
    if (g.ncId && !doiNC) oTim.current?.focus()
  }, [g.ncId, doiNC])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={dong} />
      <div className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">
              Chỗ {g.mat}
              {g.so}
            </p>
            <p className="truncate text-xs text-slate-500">
              {g.ncTen ? `${g.ncTen} · ${g.ncGiay}s` : 'Chưa gán nguyên công'}
              {g.ncId && !doiNC && (
                <button onClick={() => setDoiNC(true)} className="ml-2 text-brand-700">
                  đổi
                </button>
              )}
            </p>
          </div>
          <button onClick={dong} aria-label="Đóng" className="nut-phu px-2.5 py-1">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {doiNC ? (
            !coLenh ? (
              <div className="text-sm text-slate-600">
                <p>Chưa chọn lệnh sản xuất nên chưa có nguyên công.</p>
                <button onClick={moCaiDat} className="nut-nho mt-2">
                  Chọn lệnh và ca
                </button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Chọn nguyên công</p>
                <ul className="flex flex-col gap-1">
                  {nguyenCongs.map((nc) => (
                    <li key={nc.id}>
                      <button
                        onClick={() => {
                          ganNC({ id: nc.id, ten: nc.ten, giay: nc.giay })
                          setDoiNC(false)
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                          nc.id === g.ncId ? 'border-brand-600 bg-brand-50 font-medium' : 'border-slate-200 hover:border-brand-400'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{nc.ten}</span>
                          <span className="text-[11px] text-slate-400">{nc.boPhan}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">{nc.giay}s</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <>
              <input
                ref={oTim}
                value={tim}
                onChange={(e) => setTim(e.target.value)}
                placeholder="Tìm tên hoặc mã…"
                className="o-nhap mb-3 w-full py-2"
              />
              {[
                { nhan: 'Chưa có chỗ', ds: chuaCoCho.filter(hop) },
                { nhan: 'Đã có việc khác — giao thêm', ds: khac.filter(hop) },
              ].map((nh) =>
                nh.ds.length === 0 ? null : (
                  <div key={nh.nhan} className="mb-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {nh.nhan} · {nh.ds.length}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {nh.ds.slice(0, 80).map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => xep(c.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-400 hover:bg-brand-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{c.ten}</span>
                              <span className="block truncate text-[11px] text-slate-400">
                                {c.ma} · {c.to}
                              </span>
                              {c.noiKhac.length > 0 && (
                                <span className="block truncate text-[11px] text-amber-700">
                                  đang ở {c.noiKhac.join(', ')}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-brand-700">Xếp →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              {chuaCoCho.filter(hop).length === 0 && khac.filter(hop).length === 0 && (
                <p className="text-sm text-slate-500">Không có ai khớp ô tìm.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bảng chép từ ngày khác                                              */
/* ------------------------------------------------------------------ */

function BangChep({
  ymd,
  homNay,
  tenChuyen,
  dangChep,
  chep,
  dong,
}: {
  ymd: string
  homNay: string
  tenChuyen: string
  dangChep: boolean
  chep: (tuNgay: string, caXuong: boolean, ghiDe: boolean) => void
  dong: () => void
}) {
  const [tuNgay, setTuNgay] = useState(themNgay(ymd, -1))
  const [caXuong, setCaXuong] = useState(false)
  const [ghiDe, setGhiDe] = useState(false)

  return (
    <div className="the mb-3">
      <p className="mb-3 font-semibold">Chép sắp xếp sang ngày {ngayDai(ymd)}</p>
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
            <button onClick={() => setCaXuong(false)} className={!caXuong ? 'chip-bat' : 'chip-tat'}>
              Chỉ {tenChuyen}
            </button>
            <button onClick={() => setCaXuong(true)} className={caXuong ? 'chip-bat' : 'chip-tat'}>
              Mọi chuyền của tôi
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" checked={ghiDe} onChange={(e) => setGhiDe(e.target.checked)} />
          Ghi đè chỗ đã xếp
        </label>
        <button disabled={dangChep} onClick={() => chep(tuNgay, caXuong, ghiDe)} className="nut-nho">
          {dangChep ? 'Đang chép…' : 'Chép'}
        </button>
        <button onClick={dong} className="nut-phu">
          Đóng
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Ai ngồi chỗ nào ngày {ngayDai(tuNgay)} thì ngồi đúng chỗ đó ngày {ngayDai(ymd)}; nguyên công theo lệnh đang chạy.
        Người đã nghỉ việc hoặc nghỉ dài hạn tự bị bỏ qua. Chỗ đã nhập sản lượng không bao giờ bị ghi đè.
      </p>
    </div>
  )
}
