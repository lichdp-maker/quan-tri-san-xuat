---
name: soat-giao-dien-dien-thoai
description: Dùng khi người dùng muốn rà soát, chấm điểm hoặc tìm lỗi giao diện điện thoại của một trang đã có trong web app quản trị sản xuất, trước khi sửa.
---

# Soát giao diện điện thoại một trang có sẵn

Mục tiêu: chỉ ra CHÍNH XÁC chỗ nào trên trang sẽ khó dùng khi công nhân/tổ trưởng cầm điện thoại một tay ngoài xưởng, kèm cách sửa cụ thể. Chưa sửa gì cho tới khi người dùng đồng ý (trừ khi họ bảo sửa luôn).

## Cách làm

1. Xác định trang (`app/<duong-dan>/page.tsx`) và mọi component client nó dùng. Đọc hết, không đoán.
2. Nếu chụp được màn hình thật (Playwright viewport 360×740 và 390×844) thì chụp và xem; không chụp được thì soát theo mã và nói rõ là soát theo mã.
3. Đi qua bảng kiểm dưới đây, mỗi mục ghi: ĐẠT / LỖI / KHÔNG ÁP DỤNG.
4. Nếu có skill `web-design-guidelines` (Vercel) thì chạy thêm, gộp kết quả, bỏ trùng.
5. Trả về danh sách lỗi xếp theo mức độ, mỗi lỗi có: file:dòng, hiện tượng người dùng gặp, cách sửa (lớp Tailwind / đoạn mã cụ thể).

## Bảng kiểm

**Bố cục**
- [ ] Ở 360px trang không cuộn ngang (tìm `min-w-*`, `w-[...]` cố định, bảng không bọc `overflow-x-auto`, `whitespace-nowrap` dài).
- [ ] Lớp viết cho điện thoại trước (1 cột rồi `sm:grid-cols-2`).
- [ ] Chiều cao dùng `dvh`, thanh dính đáy chừa `safe-area-inset-bottom`.
- [ ] Nội dung chính không bị thanh dính / ngăn kéo đáy che (có `pb-*` đủ).

**Chạm**
- [ ] Mọi phần tử bấm được ≥ 44px chiều cao (`py-1` + `text-xs` thường KHÔNG đủ).
- [ ] Khoảng cách giữa các vùng bấm ≥ 8px.
- [ ] Hành động chính nằm nửa dưới màn hình hoặc dính đáy.
- [ ] Không thông tin/thao tác nào chỉ có qua hover hoặc `title`.
- [ ] Kéo-thả (nếu có) đều có đường chạm thay thế.
- [ ] Hộp thoại mở từ đáy trên điện thoại, đóng được bằng chạm ra ngoài.

**Đọc**
- [ ] Ô nhập ≥ 16px.
- [ ] Chữ phụ không nhạt hơn `text-slate-500`; `text-[10px]`/`text-[11px]` chỉ cho nhãn phụ.
- [ ] Trạng thái có chữ đi kèm màu.
- [ ] Số liệu chính đủ to, `tabular-nums`.
- [ ] Tên dài không vỡ khung (`truncate`, `min-w-0` trong flex).

**Nhập liệu**
- [ ] Ô số dùng `inputMode="numeric"`/`"decimal"`, không `type="number"` cho sản lượng.
- [ ] Lỗi báo bằng câu cụ thể ngay cạnh ô.
- [ ] Nút gửi khoá khi đang gửi và đổi chữ.

**Mạng & phản hồi**
- [ ] Thao tác thường dùng cập nhật giao diện ngay và hoàn tác khi lỗi.
- [ ] Lỗi mạng không bị nuốt im lặng.
- [ ] Trang không tải dữ liệu thừa.

## Định dạng kết quả

```
TRANG: /day-chuyen  (soát theo mã | đã chụp 360px)
Điểm: 14/20 mục đạt

LỖI NẶNG (người dùng sẽ bấm nhầm / không làm được)
1. app/day-chuyen/BanXepCho.tsx:612 — chip tổ cao ~28px, đeo găng bấm nhầm.
   Sửa: thêm `min-h-11 px-3` cho chip trong ngăn kéo đáy.

LỖI VỪA
...

GÓP Ý NHỎ
...
```

Kết thúc bằng một câu: sửa hết lỗi nặng mất khoảng bao nhiêu thay đổi, và hỏi người dùng có muốn sửa luôn không. Khi sửa, theo skill `thiet-ke-giao-dien-dien-thoai`.
