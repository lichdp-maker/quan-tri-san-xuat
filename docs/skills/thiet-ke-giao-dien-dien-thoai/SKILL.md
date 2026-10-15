---
name: thiet-ke-giao-dien-dien-thoai
description: Dùng khi xây hoặc sửa bất kỳ màn hình nào của web app quản trị sản xuất mà công nhân, tổ trưởng sẽ dùng trên điện thoại hoặc máy tính bảng ngoài xưởng.
---

# Thiết kế giao diện điện thoại cho web app nhà máy

Người dùng thật: công nhân và tổ trưởng đứng ở chuyền, cầm điện thoại MỘT TAY, có lúc đeo găng, ánh đèn xưởng chói, mạng wifi chập chờn, đang làm việc nên chỉ liếc màn hình vài giây. Thiết kế cho đúng hoàn cảnh đó trước, màn hình máy tính tính sau.

Stack: Next.js App Router + React + Tailwind. Dùng lại các lớp có sẵn trong `app/globals.css`: `.the` (thẻ), `.nut-nho` (nút chính), `.nut-phu` (nút phụ), `.chip-bat` / `.chip-tat` (chip lọc), `.o-nhap`, `.o-chon`. Màu chính `brand-*`. Không thêm thư viện giao diện mới nếu chưa hỏi.

## 1. Bắt đầu từ màn 360px

- Viết lớp Tailwind cho điện thoại trước, rồi mới thêm `sm:` `lg:` cho màn rộng. Không viết desktop rồi "bóp" xuống.
- Kiểm ở bề ngang 360px (máy Android rẻ phổ biến ở xưởng) và 390px.
- TUYỆT ĐỐI không để trang cuộn ngang. Bảng nhiều cột: bọc `overflow-x-auto` riêng bảng đó, hoặc đổi thành danh sách thẻ trên điện thoại.
- Dùng `dvh` thay `vh` cho chiều cao. Ví dụ `max-h-[60dvh]`.
- Chừa vùng an toàn cho máy có tai thỏ / thanh vuốt: `pb-[env(safe-area-inset-bottom)]` cho thanh dính đáy.

## 2. Chạm được bằng ngón cái, kể cả khi đeo găng

- Mọi thứ bấm được cao tối thiểu 44px (`min-h-11`), nút chính trên màn công nhân nên 48–56px.
- Khoảng cách giữa hai vùng bấm ≥ 8px để không bấm nhầm.
- Hành động chính đặt ở NỬA DƯỚI màn hình (vùng ngón cái): thanh nút dính đáy `fixed inset-x-0 bottom-0` hoặc ngăn kéo đáy (bottom sheet). Đầu màn hình chỉ để thông tin.
- Hộp thoại trên điện thoại = trượt từ đáy lên (`items-end`, bo góc trên), trên máy tính mới ra giữa (`sm:items-center`).
- Không có gì CHỈ hiện khi rê chuột (hover). Mọi thông tin trong `title` phải có đường khác để xem.
- Kéo-thả là phụ. Thao tác chính luôn là CHẠM: chạm chọn → chạm đặt (như bàn xếp chỗ). Kéo-thả chỉ thêm cho máy tính.

## 3. Đọc được trong vài giây

- Chữ nội dung ≥ 14px, số liệu quan trọng to (`text-2xl`–`text-3xl font-bold tabular-nums`).
- Ô nhập luôn ≥ 16px (`text-base`) — nhỏ hơn thì iPhone tự phóng to trang khi chạm vào ô.
- Tương phản cao: chữ chính `text-slate-900`, chữ phụ không nhạt hơn `text-slate-500`.
- Màu chỉ là kênh phụ: đạt/không đạt luôn có CHỮ đi kèm ("đạt", "thiếu 2 người").
- Tên người dài: `truncate` + hiện đủ ở chỗ khác; trên thẻ hẹp có thể rút còn 2 chữ cuối ("Thu Hà").
- Một màn hình một việc chính. Cấu hình, cài đặt, tuỳ chọn hiếm dùng → gom vào nút ⚙ hoặc mục gập `<details>`.

## 4. Nhập số nhanh

- Ô số: `inputMode="numeric"` và `pattern="[0-9]*"`; ô thập phân `inputMode="decimal"`. Không dùng `type="number"` cho sản lượng.
- Có sẵn giá trị gợi ý (vd: số phút của mốc chia đều) để công nhân chỉ sửa khi khác.
- Nút +/− lớn cạnh ô số cho thao tác một tay.
- Báo lỗi ngay dưới ô, bằng câu cụ thể ("Tổng 110 phút vượt mốc 90 phút"), không chỉ viền đỏ.
- `enterKeyHint="next"` / `"done"` để bàn phím có nút đi tiếp.

## 5. Mạng yếu vẫn dùng được

- Cập nhật giao diện NGAY khi chạm (lạc quan), gọi server action sau; server báo lỗi thì trả lại trạng thái cũ và hiện lý do.
- Nút đang gửi: đổi chữ ("Đang lưu…") và `disabled` để không bấm hai lần.
- Bọc lời gọi server trong try/catch: mất mạng thì báo "chưa lưu được" chứ không im lặng.
- Chỉ tải dữ liệu cần cho màn đó; danh sách dài thì lọc theo tổ/ngày trước.

## 6. Mẫu bố cục dùng lại

- **Thanh trạng thái dính trên** khi đang "cầm" một thứ: `sticky top-2 z-20 rounded-2xl bg-brand-600 text-white` + nút Bỏ.
- **Ngăn kéo đáy** cho danh sách phụ trên điện thoại, thành cột trái trên máy tính: `fixed inset-x-0 bottom-0 ... lg:sticky lg:inset-auto lg:top-3`.
- **Thẻ trạng thái** thay bảng trên điện thoại: tên + nhãn màu có chữ + số to + 1 dòng phụ + mũi tên mở.
- **Thông báo nổi** ngắn, tự tắt 3–6 giây, chạm để tắt.
- **Xác nhận hai lần** cho thao tác xoá hàng loạt — không dùng `window.confirm`.

## 7. Trước khi giao

1. Mở trang ở 360px: không cuộn ngang, nút chính trong vùng ngón cái, chữ đọc được.
2. Thử toàn bộ luồng chỉ bằng chạm.
3. Chạy `npx tsc --noEmit`; giữ phép kiểm e2e "không tràn ngang trên điện thoại".
4. Ghi rõ cho người dùng: màn này đã thử ở bề ngang nào, còn chỗ nào chưa tối ưu.
5. Nếu có skill `web-design-guidelines` (Vercel) thì soát thêm theo nó.
