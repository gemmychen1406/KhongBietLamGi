# Kiểm tra RLS

Chạy `npm run test:db` tại thư mục dự án. `tests/database.test.mjs` nạp nguyên migration trong PostgreSQL PGlite, tạo roles anon/authenticated và schema Auth/Storage tối thiểu rồi thử các thao tác với từng UID. Kiểm tra quyền thật tại database, không suy ra quyền từ nút giao diện.

Các bảng và tài khoản kiểm tra chỉ tồn tại trong database bộ nhớ của tiến trình test. Không chạy test này vào database production. Sau khi cấu hình project thật, thực hiện checklist trong `KIEM_THU.md` để kiểm chứng Auth/email, API và Storage thực tế.
