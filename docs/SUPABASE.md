# Cấu hình cộng đồng với Supabase

## 1. Tạo project và database

1. Trong Supabase Dashboard chọn **New project**, đặt tên và mật khẩu database riêng. Không đưa mật khẩu vào source.
2. Mở **SQL Editor → New query**, dán toàn bộ `supabase/migrations/001_community.sql` và bấm **Run**. Chạy một lần trên project mới; script có transaction. Không chạy chồng lên bảng cùng tên của hệ thống khác.
3. Kiểm tra **Table Editor** có `profiles`, `activity_nodes`, `activity_variants`, `resources`; RLS bật cả bốn. **Storage** có bucket public `activity-images`, tối đa 5 MB, JPEG/PNG/WebP/GIF.
4. **Authentication → Providers → Email**: bật đăng ký bằng email và xác nhận email. Không cần bật anonymous sign-in: khách dùng public API key để đọc.
5. **Authentication → URL Configuration**: Site URL là URL website; thêm URL localhost và website Vercel vào Redirect URLs. Ví dụ `http://localhost:5173` và `https://ten-web.vercel.app`. Sau khi xác nhận email, website nhận phiên và xóa token khỏi thanh địa chỉ. Bạn cũng có thể đăng nhập lại bằng email/mật khẩu.
6. Đặt chính sách mật khẩu tối thiểu 8 ký tự trong cấu hình Auth. Cấu hình SMTP riêng nếu cần gửi email thực tế ngoài giới hạn mặc định của project.

## 2. Biến môi trường

Trong **Project Settings → API / API Keys** (hoặc hộp **Connect**) lấy **Project URL** và **publishable key**. Legacy `anon` key cũng được hỗ trợ. Sao chép `.env.example` thành `.env.local` khi chạy local:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Đây là thông tin công khai trong bundle trình duyệt. Tuyệt đối không dùng `service_role`, secret key, database password hoặc JWT signing secret. Website không cần chúng. RLS là lớp kiểm soát quyền thực tế. Thiếu cấu hình sẽ hiện hướng dẫn và thư viện rỗng, không giả lập bằng dữ liệu local.

## 3. Admin đầu tiên

1. Mở website, **Đăng nhập / Đăng ký**, tạo tài khoản, xác nhận email.
2. Trong Dashboard **Authentication → Users**, sao chép UUID đúng tài khoản.
3. Trong SQL Editor chạy bằng tài khoản quản trị project:

```sql
update public.profiles
set role = 'admin'
where id = 'THAY-BANG-UUID-TAI-KHOAN';
```

4. Đăng xuất/đăng nhập lại để cập nhật giao diện. Tab **Đóng góp của tôi** của Admin có form **Quản lý quyền**. Chọn **Xem thành viên**, chọn đúng tài khoản, chọn Member/Admin và xác nhận.

RPC `set_member_role` tự kiểm tra Admin trong database, không tin role gửi từ frontend và chặn hạ quyền Admin cuối cùng. Member không được UPDATE/INSERT profiles. Tên hiển thị được tạo khi đăng ký; `user_metadata.role` không có tác dụng. Nếu mất quyền truy cập Admin, chủ project có thể phục hồi bằng SQL quản trị trên.

## 4. Dữ liệu mẫu và dữ liệu cũ

- **Mẫu:** Admin mở **Thư viện → Thêm dữ liệu mẫu (Admin)** và xác nhận. Chỉ thêm một lần để tránh bản trùng. Không tự thêm mẫu khi tải trang.
- **Dữ liệu phiên bản cũ trên cùng trình duyệt/domain:** chọn **Tải bản gốc trước nâng cấp** ở chân trang. Khóa localStorage cũ không bị ghi đè. Nếu đã đổi domain hoặc thiết bị, xuất JSON trên website cũ trước.
- **Nhập JSON:** đăng nhập, tải thư viện thành công, chọn **Sao lưu dữ liệu → Chọn file JSON**, kiểm tra số lượng rồi xác nhận. Mọi node, variant và resource được cấp ID mới, ghi dưới tài khoản đang nhập. Người tạo trong JSON không được dùng để cấp quyền. Nội dung cộng đồng hiện có được giữ nguyên; lịch sử trên thiết bị được thay bằng lịch sử trong JSON. Nhập lại cùng file sẽ tạo bản sao; không tự gộp theo tiêu đề.
- Import ghi nội dung trong một transaction; lỗi quyền/ràng buộc sẽ rollback toàn bộ nội dung của lần nhập. Tối đa 10 MB/file và 10.000 thay đổi/lần; chia cây lớn thành nhiều file hợp lệ nếu cần.
- Xuất JSON gồm thư viện tải từ server và snapshot lịch sử của thiết bị. Đây là backup logic của nội dung, không bao gồm tài khoản, quyền, mật khẩu hay byte ảnh Storage. Muốn phục hồi cả file ảnh/project cần backup Storage và database qua công cụ quản trị Supabase.

## 5. Quy tắc hoạt động

- Toàn bộ thư viện hiện tại là công khai; `enabled` chỉ điều khiển random, không ẩn nội dung.
- Member thêm nhóm/hoạt động ở gốc hoặc dưới nhóm của bất kỳ tác giả nào; thêm biến thể/tài nguyên vào hoạt động của người khác. Mỗi đóng góp có tác giả riêng.
- Chỉ tác giả hoặc Admin được sửa/xóa. Khóa ID, `created_by`, vị trí cha và loại node không được đổi. Không hỗ trợ chuyển nhánh để tránh di chuyển đóng góp của người khác hoặc tạo chu trình.
- Muốn xóa nhánh/hoạt động/biến thể phải xử lý từng phụ thuộc trước. FK `RESTRICT` bảo vệ cả khi gọi API trực tiếp; không cascade nội dung cộng đồng. Admin cũng phải xóa từ tài nguyên, biến thể, lá lên gốc.
- Form lưu trong transaction và đối chiếu bản gốc để báo xung đột. Khi bị xung đột hãy đóng form, **Tải lại thư viện** rồi mở lại. Nội dung mới của người khác không bị form cũ tự xóa.
- Ảnh upload vào `<user UUID>/<UUID file>`, giữ nguyên đường dẫn, không cho overwrite. Upload chỉ nhận JPEG/PNG/WebP/GIF tối đa 5 MB; SVG bị loại. Có thể dùng URL ảnh http(s) bên ngoài như trước.
- Tab **Đóng góp của tôi → Ảnh đã tải lên** cho xóa file của mình, kể cả ảnh thừa khi bỏ form. Admin nhập UUID thư mục để quản lý ảnh vi phạm. Xóa file là thao tác riêng với xóa tài nguyên; xác nhận trước vì các liên kết công khai dùng file đó sẽ hỏng. Ảnh public có thể còn trong cache một thời gian.
- Thư viện được tải khi mở/reload website và sau lần ghi thành công. Nút tải lại lấy đóng góp mới. Chưa dùng realtime subscription.
- Lịch sử snapshot vẫn nằm trên thiết bị, không đồng bộ theo tài khoản; người dùng chung trình duyệt có thể thấy cùng lịch sử. Dữ liệu local cũ được giữ nguyên. Đăng nhập sử dụng phiên Auth trong localStorage và refresh token; không lưu mật khẩu.

## 6. Vercel và GitHub Web

1. Trên GitHub tạo repository, **Add file → Upload files**, kéo source theo danh sách ở README. Giữ `.env.example`, không tải `.env.local` hoặc file bí mật.
2. Trên Vercel **Add New → Project → Import** repository; Framework **Vite**, Build `npm run build`, Output `dist`.
3. **Environment Variables**: thêm hai biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` cho Production và môi trường Preview nếu dùng. Không nhập secret/service role key.
4. Bạn tự chọn **Deploy** sau khi cấu hình. Biến Vite được đóng vào bundle lúc build; khi đổi biến cần redeploy. Cập nhật Site URL/Redirect URLs trong Supabase cho domain thực tế.
5. Thử bằng cửa sổ ẩn danh và hai tài khoản theo `KIEM_THU.md` trước khi dùng rộng rãi.

## Tài liệu chính thức

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth REST](https://github.com/supabase/auth/blob/master/README.md)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
