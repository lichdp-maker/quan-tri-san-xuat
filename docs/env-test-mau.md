# Mẫu tệp `.env.test`

Bộ test tích hợp cần một **CSDL riêng**. Tự tạo tệp `.env.test` ở thư mục gốc dự án
(nó đã nằm trong `.gitignore`, không lên GitHub) với nội dung sau:

```dotenv
DATABASE_URL="<dán chuỗi kết nối THẬT của nhánh test>"
DIRECT_URL="<dán chuỗi kết nối THẬT của nhánh test>"
```

Hai biến đặt **cùng một chuỗi**, và phải đúng tên `DATABASE_URL` / `DIRECT_URL` —
Prisma chỉ đọc hai tên này. Đặt tên khác thì `npm run db:test` sẽ lặng lẽ rơi về
`.env`, tức là chạy migration lên **CSDL đang dùng thật**.

> Chuỗi thật trông như thế này — chú ý phần sau `@` là mã endpoint ngẫu nhiên Neon
> cấp cho nhánh, **không phải** `ep-xxx`:
>
> `postgresql://neondb_owner:npg_K3f9...@ep-cool-frost-a1b2c3-test.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
>
> Nếu còn thấy `ep-xxx` hoặc `user:pass` thì nghĩa là chưa thay. `npm run db:test`
> sẽ dừng lại và nói rõ, thay vì để Prisma báo `P1000 Authentication failed`.

## Lấy chuỗi kết nối ở đâu

Trên Neon Console → chọn dự án → **Branches** → **New branch** → đặt tên có chữ `test`
→ copy chuỗi kết nối của nhánh vừa tạo.

Nhánh Neon nhân bản cấu trúc bảng từ nhánh chính, không tốn thêm tiền đáng kể, và
xoá đi lúc nào cũng được.

## Vì sao bắt buộc phải là CSDL riêng

Trước mỗi lần chạy, bộ test **xoá sạch mọi bảng**. Trỏ nhầm vào CSDL đang dùng thật
là mất toàn bộ số liệu sản xuất của 46 người.

`tests/moi-truong.ts` có một hàng rào: nếu chuỗi kết nối không chứa `test`, `dev`,
`local` hoặc `branch` thì nó dừng ngay và không chạy test nào. Đó là lý do nhánh
phải đặt tên có chữ `test`.

## Các bước đầy đủ

```powershell
cd "D:\Xưởng CNC\QUẢN LÝ SẢN PHẨM EMIC-GEIC\AI QUAN TRI NMTM"
npm install
npm run db:test
npm run test:tichhop
```

`npm run db:test` đưa migration lên nhánh test. Chạy lại mỗi khi schema đổi.

## Biến cho Playwright E2E

Không bắt buộc — thiếu thì các test cần đăng nhập tự bỏ qua, phần còn lại vẫn chạy.
Đặt trong cùng tệp `.env.test` hoặc truyền thẳng ở dòng lệnh:

```dotenv
E2E_MA=EMIC1053
E2E_MK=...
E2E_CN_MA=...
E2E_CN_MK=...
E2E_TT_MA=...
E2E_TT_MK=...
```
