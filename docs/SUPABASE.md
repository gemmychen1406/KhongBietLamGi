# Cấu hình cộng đồng với Supabase

## Website đã có 4 bảng và bucket: một thao tác bắt buộc

Môi trường Codex chưa có công cụ/phiên quản trị Supabase, CLI được xác thực hay database URL. Không có lệnh quản trị từ xa nào được thực thi và không thể xác nhận trạng thái live qua mạng ở môi trường này.

Trên project hiện có, mở **SQL Editor → New query** → copy **toàn bộ** file [002_system_seed.sql](../supabase/migrations/002_system_seed.sql) → **Run**. Không sửa nội dung file, không chạy lại 001, không tạo tài khoản để làm chủ mẫu. Sau đó tải lại website bản đã nâng cấp. Nếu hai biến Vercel đã đúng thì giữ nguyên chúng.

Script tự kiểm tra `supabase_migrations.schema_migrations` nếu bảng này có sẵn, rồi kiểm tra các bảng/cột/khóa ngoại và các hàm phân quyền. SQL Editor có thể đã chạy 001 mà không có bản ghi CLI; script nhận biết schema hiện hữu, **không chạy lại 001** và không sửa lịch sử CLI. Ledger riêng trong schema private ghi checksum sau khi toàn bộ lần khởi tạo hoàn tất. Nếu schema không tương thích hoặc checksum khác, transaction dừng an toàn thay vì ghi đè. Không gọi `db push`, không reset, không xóa database.

Mẫu có đủ 42 nhóm, 42 hoạt động, 17 biến thể và 4 tài nguyên lấy trực tiếp từ `src/data/seed.ts`. `scripts/generate-system-seed.mjs` sinh SQL bằng UUID/khóa cố định theo đường dẫn nội dung. Chạy lại cùng file không tạo bản trùng; marker lần chạy cũng bảo toàn những mẫu Admin đã sửa/xóa. Đóng góp có sẵn không bị sửa/xóa hay nhận làm nội dung hệ thống; các bản ghi thành viên có tiêu đề trùng vẫn giữ nguyên quyền sở hữu.

### Quyền sở hữu hệ thống

Không có tài khoản Auth giả. Migration thêm `system_seed_key`, giữ FK `created_by → auth.users`, và thay NOT NULL đơn giản bằng ràng buộc phân biệt hai trường hợp: **thành viên** có `created_by` hợp lệ và không có system key; **hệ thống** có system key riêng và `created_by` NULL. Mọi hàng thành viên cũ giữ nguyên tác giả và giá trị. INSERT của authenticated user luôn phải có `created_by = auth.uid()` và không có system key; kể cả Admin trên website cũng không thể tự chèn seed hệ thống. UPDATE không được đổi tác giả, system key hoặc vị trí. Chỉ Admin được sửa/xóa mẫu hệ thống, vẫn tuân thủ FK bảo toàn đóng góp con.

Đọc thư viện dùng `get_public_library()` với RLS và một snapshot nhất quán, không dựa vào phiên đăng nhập. Bản source mới vẫn đọc bảng phân trang để tương thích khi 002 chưa chạy; lỗi quyền không bị hiểu nhầm là thư viện rỗng.

## 1. Chỉ dành cho project mới chưa có bảng

1. Trong Supabase Dashboard chọn **New project**, đặt tên và mật khẩu database riêng. Không đưa mật khẩu vào source.
2. Mở **SQL Editor → New query**, chạy `supabase/migrations/001_community.sql` duy nhất một lần trên project trống; sau đó chạy `002_system_seed.sql` để có mẫu hệ thống. Project đang có bảng thì bỏ qua 001 và chỉ làm thao tác ở đầu tài liệu.
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

Đây là thông tin công khai trong bundle trình duyệt. Tuyệt đối không dùng `service_role`, secret key, database password hoặc JWT signing secret. Website không cần chúng. RLS là lớp kiểm soát quyền thực tế. Thiếu cấu hình vẫn random được mẫu cục bộ chỉ đọc, luôn có nhãn chưa đồng bộ. Mẫu không được tự động ghi vào Supabase từ trình duyệt.

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

- **Mẫu:** chạy file SQL 002 một lần theo đầu tài liệu; không cần tài khoản Admin trên website. Không còn nút thêm mẫu gây trùng trong UI. Nếu chưa có dữ liệu chung, chỉ hiển thị mẫu cục bộ ở chế độ chỉ đọc.
- **Dữ liệu phiên bản cũ trên cùng trình duyệt/domain:** chọn **Tải bản gốc trước nâng cấp** ở chân trang. Khóa localStorage cũ không bị ghi đè. Nếu đã đổi domain hoặc thiết bị, xuất JSON trên website cũ trước.
- **Nhập JSON:** đăng nhập, tải thư viện thành công, chọn **Sao lưu dữ liệu → Chọn file JSON**, kiểm tra số lượng rồi xác nhận. Mọi node, variant và resource được cấp ID mới, ghi dưới tài khoản đang nhập. Người tạo trong JSON không được dùng để cấp quyền. Nội dung cộng đồng hiện có được giữ nguyên; lịch sử trên thiết bị được thay bằng lịch sử trong JSON. Nhập lại cùng file sẽ tạo bản sao; không tự gộp theo tiêu đề.
- Import ghi nội dung trong một transaction; lỗi quyền/ràng buộc sẽ rollback toàn bộ nội dung của lần nhập. Tối đa 10 MB/file và 10.000 thay đổi/lần; chia cây lớn thành nhiều file hợp lệ nếu cần.
- Xuất JSON gồm thư viện đang hiển thị và snapshot lịch sử của thiết bị. Khi đang ở chế độ mẫu, dialog và tên file nêu rõ mẫu cục bộ chưa đồng bộ; import vào cộng đồng bị khóa trong chế độ này. Đây là backup logic của nội dung, không bao gồm tài khoản, quyền, mật khẩu hay byte ảnh Storage. Muốn phục hồi cả file ảnh/project cần backup Storage và database qua công cụ quản trị Supabase.

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

- [Lịch sử Supabase migrations và thay đổi qua SQL Editor](https://supabase.com/docs/guides/deployment/database-migrations)
