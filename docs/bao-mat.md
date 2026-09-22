# Sổ theo dõi bảo mật — Nhà máy thông minh EMIC

Rà soát theo checklist `security-reviewer` + `code-review` của ECC.
Ngày rà: 22/09/2026. Phạm vi: toàn bộ server action, middleware, phiên đăng nhập, phân quyền trang.

## Kết quả: 13 phát hiện — đã xử lý 13

| # | Mức | Vấn đề | Cách xử lý | Tệp |
|---|-----|--------|-----------|-----|
| 1 | CRITICAL | Tổ trưởng tự phân công, tự nhập, tự duyệt sản lượng của chính mình | Bộ lọc duyệt loại bỏ bản ghi có `userId` = người duyệt | `lib/quyen.ts`, `app/to-truong/actions.ts` |
| 2 | CRITICAL | Phiên JWT 30 ngày không đối chiếu CSDL — người nghỉ việc vẫn nhập được, hạ quyền không có hiệu lực | Token chỉ mang `id`; vai trò, tổ, trạng thái đọc lại từ CSDL mỗi lượt, bọc `cache()` | `lib/session.ts` |
| 3 | HIGH | `doneQtyOk` cộng hai lần khi bấm duyệt hai lần | `updateMany` có điều kiện `status: PENDING`, chỉ cộng khi đổi được đúng 1 dòng | `app/to-truong/actions.ts` |
| 4 | HIGH | `doneQtyOk` trừ hai lần, xuống số âm khi lưu trùng lúc | Cùng cách: đổi `APPROVED → PENDING` trước, chỉ trừ khi count = 1 | `app/cong-nhan/actions.ts` |
| 5 | HIGH | Tổ trưởng thao tác được lên dây chuyền và phân công của tổ khác | `ngoaiPhamViTo()` áp cho 4 hàm nhận `seatId`/`lineId` | `lib/quyen.ts`, `app/day-chuyen/actions.ts` |
| 6 | HIGH | Quản lý xưởng đặt lại được mật khẩu giám đốc, và tự nâng mình lên giám đốc | Thứ bậc `caoHon()`; `duocSuaNguoiDung()`, `duocDatLaiMatKhau()` | `lib/quyen.ts`, `app/quan-tri/actions.ts` |
| 7 | HIGH | Mọi tài khoản dùng chung PIN `123456`, không có cơ chế bắt đổi | Cờ `mustChangePassword`; quy tắc mật khẩu; sinh PIN ngẫu nhiên khi tạo hàng loạt | `lib/mat-khau.ts`, `prisma/schema.prisma` |
| 8 | MEDIUM | `timTen` không cần đăng nhập, dò được họ tên toàn bộ nhân sự | Chỉ khớp mã chính xác ≥ 6 ký tự, trả tên rút gọn, giới hạn 30 lần/phút theo tiền tố mã | `app/dang-nhap/actions.ts` |
| 9 | MEDIUM | Tổ trưởng kết luận được phiếu lỗi của tổ khác | `updateMany` kèm điều kiện `entry.assignment.teamId` | `app/ky-thuat/actions.ts` |
| 10 | MEDIUM | `taoPhanCong` tin `orderOperationId`/`shiftId` client gửi — phân công vào lệnh đã đóng | Kiểm `lenhConNhanSanLuong()` và `shift.isActive` | `app/to-truong/actions.ts` |
| 11 | MEDIUM | Công nhân sửa đè bản ghi đã duyệt sau khi số đã lên báo cáo | Chặn với vai trò WORKER; phải nhờ tổ trưởng từ chối trước | `app/cong-nhan/actions.ts` |
| 12 | LOW | Trang `/cong-nhan` thiếu cổng vai trò | Thêm `DUOC_VAO` như 8 trang còn lại | `app/cong-nhan/page.tsx` |
| 13 | LOW | Nhập trước được cho mốc giờ chưa bắt đầu | So `gioHienTai()` với `slot.startTime` ở phía máy chủ | `app/cong-nhan/actions.ts` |

## Việc thêm ngoài danh sách phát hiện

- Khoá tài khoản 15 phút sau 5 lần sai mật khẩu liên tiếp.
- Thông báo đăng nhập gộp làm một: sai mã và sai mật khẩu ra cùng một câu.
- Băm giả khi mã không tồn tại, để không đoán được mã thật qua thời gian phản hồi.
- Header: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; tắt `X-Powered-By`.
- Đổi mật khẩu làm hết hiệu lực mọi phiên cũ trên mọi máy (`passwordChangedAt` so với `iat` của token).

## Còn nợ

- **CSP chưa bật.** Next còn chèn script nội tuyến nên cần nonce trong middleware; làm riêng để không chặn nhầm cả trang.
- **Repo GitHub phải để Private.** Kiểm lại trong Settings của repo.
- **Rate limit `timTen` chỉ nằm trong bộ nhớ tiến trình.** Vercel chạy nhiều tiến trình nên đây là hàng rào mềm, không phải hàng rào cứng.

## Cách chạy test

Ba tầng, mỗi tầng một ngưỡng riêng có ý nghĩa riêng.

```
npm test               # đơn vị — logic thuần trong lib/, vài giây, không cần CSDL
npm run test:cov       # kèm coverage, ngưỡng 90% cho lib/
npm run test:tichhop   # tích hợp — chạy server action trên CSDL test thật
npm run test:all       # cả hai, kèm coverage
npm run build && npm run test:e2e   # Playwright trên bản build ở máy
```

Ngưỡng coverage cố ý **không** đặt một con số chung cho cả dự án. Đặt 80% cho toàn bộ
thì phần lớn con số đến từ JSX hiển thị — test nó tốn công mà bắt được ít lỗi, còn
phần thật sự nguy hiểm thì vẫn có thể hở. Nên:

- `lib/**` — công thức năng suất, ngày giờ, mật khẩu, phân quyền: **ngưỡng 90%**, hiện đạt ~97%.
- `app/**/actions.ts` — cần CSDL thật: ngưỡng đặt ở mức bộ test tích hợp hiện phủ,
  **nâng dần khi thêm test, không hạ xuống cho qua**.
- `lib/session.ts` và `lib/prisma.ts` không tính: chúng đụng cookie, jose và khởi tạo
  client nên chỉ chạy được trong Next. Phần quyết định của session đã tách sang
  `phienConHieuLuc()` trong `lib/quyen.ts` và có test đầy đủ, kể cả ranh giới làm tròn giây.

### Chạy test tích hợp

Cần một CSDL **riêng**, vì bộ test xoá sạch mọi bảng trước mỗi lần chạy.

1. Trên Neon: Branches → New branch → đặt tên có chữ `test`.
2. Tạo tệp `.env.test` ở thư mục gốc, khai báo `DATABASE_URL` và `DIRECT_URL`
   **cùng trỏ vào nhánh test** (đúng hai tên này, vì Prisma chỉ đọc chúng).
   Mẫu đầy đủ trong `docs/env-test-mau.md`.
3. `npm run db:test` để đưa migration lên nhánh test.
4. `npm run test:tichhop`.

`tests/moi-truong.ts` từ chối chạy nếu URL không nhận ra được là CSDL test — hàng rào
chống trỏ nhầm vào CSDL sản xuất. `.env.test` nằm trong `.gitignore`.

### Chạy E2E

E2E cần tài khoản thật qua biến môi trường, và **không chạy trên CSDL đang dùng thật**
vì nó tạo và sửa dữ liệu:

```
E2E_MA=... E2E_MK=... E2E_CN_MA=... E2E_CN_MK=... E2E_TT_MA=... E2E_TT_MK=... npm run test:e2e
```

## Nguyên tắc giữ về sau

1. Mọi `id` client gửi lên đều phải kiểm thuộc phạm vi người gọi, không bao giờ tin thẳng.
2. Quy tắc phân quyền viết trong `lib/quyen.ts` dưới dạng hàm thuần, có test — action chỉ nạp dữ liệu rồi hỏi.
3. Bộ đếm luỹ kế (`doneQtyOk`) chỉ đổi khi chính lượt đó đổi được trạng thái, kiểm bằng `count`.
4. Không ai duyệt số liệu của chính mình.
