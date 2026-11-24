# Nâng cấp quyền sửa chung và trang Đóng góp của tôi

## Thao tác duy nhất cần làm trên Supabase nếu đã chạy 001/002

Mở **Supabase Dashboard → SQL Editor → New query**, copy toàn bộ [003_collaborative_editing.sql](../supabase/migrations/003_collaborative_editing.sql) rồi **Run**. Không sửa file, không chạy lại 001/002, không reset database. Sau khi website đã nhận source mới, tải lại trang.

Nếu website còn hiển thị **Mẫu cục bộ · Chỉ đọc · Chưa đồng bộ** vì database trống/chưa khởi tạo, chạy file **002_system_seed.sql** trước, rồi file **003_collaborative_editing.sql**. Hai file có nhiệm vụ khác nhau. Không chạy 001 chồng lên các bảng hiện có.

Không đổi biến môi trường, không cần secret/service role key. Codex không có kết nối quản trị Supabase trong môi trường này nên chưa chạy migration trên project thật; file được kiểm tra trên PostgreSQL PGlite.

## Quyền mới

| Thao tác | Guest | Member hợp lệ | Admin |
| --- | --- | --- | --- |
| Xem thư viện, chọn nhóm, random và tài nguyên | Có | Có | Có |
| Thêm nhóm/hoạt động/variant/resource vào bất kỳ nhóm/hoạt động hợp lệ | Không | Có, tác giả là tài khoản đang đăng nhập | Có, tác giả là tài khoản đang đăng nhập |
| Sửa nội dung của hệ thống hoặc tài khoản khác | Không | Có | Có |
| Xóa nội dung | Không | Chỉ nội dung chính mình tạo | Mọi tác giả, vẫn tuân thủ FK |
| Đổi tác giả/ID/system key/vị trí/loại node | Không | Không | Không qua editor/API |
| Đổi quyền tài khoản | Không | Không | RPC Admin hiện có; bảo vệ Admin cuối cùng |

`canEdit` và `canDelete` đã được tách riêng. Không dùng quyền sửa làm điều kiện cho nút xóa. Form của Member có thể sửa metadata của node, variant và resource do người khác/hệ thống tạo; tác giả gốc không bị đổi. Cấu trúc cây vẫn phân biệt group/activity, không hỗ trợ di chuyển nhánh.

## Database và xung đột

- RLS vẫn bật trên `activity_nodes`, `activity_variants`, `resources`, `profiles`. UPDATE có cả USING và WITH CHECK, yêu cầu UID có profile Member/Admin. INSERT giữ đúng `created_by = auth.uid()` và không cho giả mạo nội dung hệ thống. DELETE có restrictive policy để không bị policy permissive khác vô tình mở rộng.
- `profiles` không có quyền INSERT/UPDATE/DELETE cho client. Quản lý quyền vẫn qua RPC `set_member_role` kiểm tra Admin bằng dữ liệu quản trị, không qua user_metadata.
- Thêm `updated_by` (FK Auth), `updated_at`, `revision`. Trigger riêng `guard_collaborative_content` tự ghi người sửa, thời điểm sửa và tăng revision; không tin metadata client gửi. Dữ liệu cũ giữ nguyên tác giả và nội dung; `updated_by`/`updated_at` của các lần sửa trước nâng cấp không được bịa thêm.
- `apply_community_changes` tiếp tục SECURITY INVOKER và transaction toàn bộ. UPDATE/DELETE yêu cầu snapshot gốc kèm revision, khóa bản ghi và đối chiếu trước khi ghi. Nếu người khác đã sửa, kể cả sửa rồi đổi lại cùng giá trị, yêu cầu cũ bị từ chối bằng lỗi xung đột.
- Nếu lỗi, form giữ bản nháp; đóng form, bấm **Tải lại thư viện**, mở lại rồi áp dụng thay đổi vào bản mới. Không tự ghi đè hoặc retry mù.
- Migration 002 được giữ nguyên. Trigger riêng của 003 không bị 002 ghi đè khi 002 vô tình được chạy lại; bài kiểm thử đã xác nhận audit/revision và quyền mới còn nguyên.
- Frontend chỉ mở nút ghi khi đã tải thư viện chung có revision. Thiếu 003 hoặc đang xem mẫu/lỗi tải thì chỉ đọc và có hướng dẫn trong **Chi tiết** ở thanh nguồn dữ liệu. Không chỉ bật nút frontend để bỏ qua cấu hình database.

## Trang cá nhân

- Bốn card thống kê: hoạt động, chủ đề/biến thể, tài nguyên và ảnh. Nhóm có thống kê phụ riêng; ảnh hiển thị `—` khi không truy vấn được, không báo 0 giả.
- Ba tab: **Hoạt động của tôi**, **Chủ đề và tài nguyên**, **Ảnh đã tải lên**. Chỉ dùng `created_by` để tính đóng góp. `updated_by` không làm nội dung người khác xuất hiện như đóng góp do mình tạo.
- Card có đường dẫn, ngày tạo khi có dữ liệu, xem chi tiết và mở editor đúng hoạt động. Tài nguyên có thumbnail/preview/liên kết an toàn. Empty state có lời dẫn và nút mở Thư viện.
- Ảnh tự tải theo thư mục UID; có thumbnail, mở ảnh, tải lại, xóa sau xác nhận. Bỏ form upload không xóa file ngầm. Trong lúc upload, editor tạm khóa lưu/chỉnh sửa để không lưu dở dang hoặc làm mất cập nhật trong form.
- Admin có tab **Quản trị** riêng cho thành viên và ảnh cộng đồng; không trộn vào danh sách đóng góp cá nhân.

## Upload

Danh sách đầy đủ file mới/sửa tại [CAC_FILE_CAN_UPLOAD.md](../CAC_FILE_CAN_UPLOAD.md). Mở repo `gemmychen1406/KhongBietLamGi` → **Add file → Upload files**, giữ nguyên đường dẫn thư mục. Không upload `node_modules`, `dist`, `.local`, `.env` hoặc secret. Codex không push/deploy.
