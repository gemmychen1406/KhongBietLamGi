# Kiểm thử phiên bản cộng đồng

## Lệnh tự động

- `npm run build`: TypeScript strict và bundle Vite.
- `npm test`: utilities, random/tree, import/export, adapter dữ liệu, Auth REST (HTTP giả lập), giao diện DOM; tiếp đó thực thi migration và kiểm tra RLS trong PostgreSQL PGlite.
- `npm run test:db`: chỉ kiểm tra database. File thực thi: `tests/database.test.mjs`.

Database test dùng role `anon` / `authenticated` và từng UID; không chạy tất cả câu lệnh dưới quyền postgres. Schema Auth/Storage được dựng tối thiểu để kiểm tra policies của migration. Mỗi lần chạy tạo database bộ nhớ mới; không kết nối project thật.

## Checklist trên Supabase thật sau cấu hình

Tạo ba tài khoản thử nghiệm A, B, Admin, xác nhận email và cấp Admin bằng SQL Editor. Dùng các cửa sổ/trình duyệt khác nhau để không dùng chung phiên. Tất cả nội dung hiện là công khai.

| Tình huống | Thao tác | Kết quả cần đạt |
| --- | --- | --- |
| 1. Guest | Mở ẩn danh, random, xem chi tiết và link/ảnh | Đọc/random được, không thấy nút thêm/sửa/xóa; gọi API ghi bằng public key bị từ chối |
| 2. A → B | A thêm nhóm và hoạt động; B tải lại website | B và khách thấy cùng nội dung, tên tác giả A |
| 3. Đóng góp chéo | B mở hoạt động A, thêm variant, thêm tài nguyên chung và tài nguyên variant | Ghi được; từng variant/resource có `created_by` là B, node vẫn là A |
| 4. Sửa chung, xóa riêng | B mở hoạt động A | Sau 003, B sửa được node/variant/resource A và hệ thống; tác giả gốc giữ nguyên, updated_by là B; không có quyền DELETE A hoặc hệ thống |
| 5. Bảo toàn phụ thuộc | A thử xóa nhóm/hoạt động có con hoặc variant/resource của B | Bị chặn và giải thích; nội dung B còn nguyên; DELETE trực tiếp trả lỗi FK |
| 6. Không tự cấp Admin | A gọi RPC `set_member_role` với chính mình hoặc UPDATE profiles, sửa user_metadata.role | Database từ chối; `is_admin()` vẫn false |
| 7. Admin | Admin sửa nội dung A/B, xóa tài nguyên/variant/lá rồi xóa nhánh trống; đổi vai trò B qua UI | Thành công theo thứ tự phụ thuộc; Admin cuối cùng không thể bị hạ quyền |
| 8. Đồng bộ lâu dài | Tắt trình duyệt A; B mở từ điện thoại/thiết bị khác, refresh | Thư viện vẫn hiện từ Supabase; lịch sử cá nhân trên thiết bị khác không được coi là đã đồng bộ |

## Auth và Storage thực tế

1. Đăng ký, nhận email, mở liên kết và kiểm tra URL không còn token. Đăng xuất rồi đăng nhập; email chưa xác nhận phải được báo phù hợp. Thử email/mật khẩu sai.
2. Reload trang đã đăng nhập, chờ quá hạn access token rồi thao tác; phiên được refresh. Thử hai tab và đăng xuất ở một tab.
3. B upload ảnh PNG/JPEG/WebP/GIF ≤5 MB qua form tài nguyên, lưu form, reload và mở bằng ẩn danh. Kiểm tra path `B-UUID/file-UUID` trong Dashboard.
4. Thử SVG hoặc >5 MB: UI từ chối; thử upload trực tiếp qua API để xác nhận bucket cũng chặn.
5. Thử upload vào UUID của A bằng JWT B: từ chối. B không xóa được ảnh A; Admin xóa được. Không cho overwrite/upsert file cũ.
6. B bỏ form sau upload: ảnh thừa nằm trong **Đóng góp của tôi → Ảnh đã tải lên**, có thể xóa sau xác nhận. Kiểm tra thông báo khi file đã mất hoặc quyền bị thu hồi.

## CRUD, xung đột và backup

- B thêm nhóm con/hoạt động vào nhóm A hoặc hệ thống, reload: cây và tác giả đúng. B sửa nội dung A/hệ thống nhưng chỉ xóa nội dung B tạo; URL chỉ nhận http(s).
- Hai cửa sổ mở cùng node; một bên lưu sửa tên, bên còn lại lưu bản cũ: báo xung đột, không ghi đè im lặng.
- Khi editor A đang mở, B thêm variant/resource: A chỉ sửa tiêu đề, đóng góp B phải vẫn tồn tại.
- Mất mạng giữa lần lưu: không có nội dung được ghi dở dang; sau kết nối lại tải thư viện trước khi thử lại. Nếu mất phản hồi sau khi server đã commit, tải lại để xác định kết quả trước khi tạo lại.
- Xuất JSON, thử JSON hỏng, preview file hợp lệ, hủy xác nhận rồi nhập thật: file sai/hủy không ghi; import thật thêm bản sao với ID mới và tác giả người nhập. Lịch sử cá nhân chỉ thay khi đã xác nhận. Không xóa nội dung cộng đồng cũ.
- Dữ liệu localStorage bản cũ giữ nguyên sau nâng cấp. Khóa cá nhân mới chỉ lưu lịch sử/snapshot, không làm nguồn thư viện.
- Random nhánh tắt, chỉ 0/1 lựa chọn, suffix giữ prefix và snapshot không đổi khi sửa/xóa bản gốc.
- Thử lỗi quota/storage bị chặn, ảnh hỏng, thư viện rỗng và mất kết nối: báo lỗi, vẫn xuất được dữ liệu đang có.
- Kiểm tra layout 360/390/768/1440 px, keyboard Tab/Enter/Escape, focus modal, reduced motion và liên kết ngoài.

## Giới hạn kết quả trong Codex

Kết quả tự động được ghi ở phần bàn giao. Chưa cấu hình URL/public key của project trong môi trường này, nên email thật, Storage HTTP thật, truy cập hai thiết bị, responsive trên trình duyệt thật và triển khai Vercel cần thực hiện checklist trên. Không suy ra rằng các bước này đã được kiểm chứng từ việc unit test hoặc PGlite pass.

## Kết quả lần triển khai phân quyền trước (24/11/2026)

- `npm run build`: **PASS**, TypeScript và Vite hoàn tất, output `dist`.
- `npm test`: **PASS**, 38 tests Vitest (4 files) + 13 tests PostgreSQL PGlite, tổng **51 tests**.
- Các bài Auth HTTP dùng mock; các bài database thực thi migration/RLS thực tế trong PGlite với schema Supabase tối thiểu. Chưa chạy vào Supabase cloud, chưa gửi email hay upload file lên bucket thật, chưa deploy.
- Cài Supabase SDK từ npm bị lỗi DNS `EAI_AGAIN`; triển khai dùng REST Auth/PostgREST/Storage của Supabase và `fetch`, không thêm dependency SDK chưa cài được. PGlite dành cho test được lấy từ gói đã có trong npm cache; lockfile dùng URL registry và integrity chuẩn, không tham chiếu file `/tmp`.


## Kiểm thử bổ sung cho khởi tạo mẫu và guest random

- SQL 002 chạy được khi 001 đã tạo bảng bằng SQL Editor nhưng không có ledger CLI, hoặc đã có ledger CLI. Không chạy lại 001 và không sửa ledger CLI.
- Không có Auth user vẫn khởi tạo đủ 84 node (42 nhóm/42 hoạt động), 17 biến thể và 4 tài nguyên. Nội dung từng trường được đối chiếu với dữ liệu sinh trực tiếp từ seed.ts.
- Chạy lại giữ nguyên ID, timestamps, mọi dữ liệu thành viên có trước và đóng góp mới sau khởi tạo. Mẫu đã được Admin sửa/xóa không bị khôi phục.
- Member không được chèn hàng hệ thống, làm mất tác giả của nội dung thường, chiếm quyền hoặc sửa/xóa mẫu. Member vẫn thêm nhóm/hoạt động/variant/resource dưới nội dung hệ thống.
- Transaction lỗi giữa chừng rollback cả DDL lẫn seed; dữ liệu cũ còn nguyên, chạy lại bản đúng được. Checksum khác bị chặn an toàn.
- Guest random đủ ba nhóm khi thiếu cấu hình, đang tải, lỗi mạng hoặc Supabase rỗng; lịch sử đánh dấu mẫu chưa đồng bộ. Ngay cả Admin cũng không ghi thư viện khi đang xem mẫu cục bộ.
- Tải lại có dữ liệu cộng đồng sẽ thay mẫu; lỗi tải lại sau khi đã có cộng đồng giữ dữ liệu vừa tải, không trộn mẫu. Đọc công khai không đòi refresh phiên đăng nhập đã hết hạn.
- Snapshot RPC trả toàn bộ cây trong một lần đọc. Tương thích trước 002 bằng phân trang đến trang rỗng, không dừng sớm khi server giới hạn nhỏ hơn 500 dòng. Kiểm tra thiếu cha, chu trình và tài nguyên gắn sai variant.

Không có kết nối quản trị Supabase trong môi trường Codex. DNS/truy cập website live cũng không thành công. Kiểm thử thực thi PostgreSQL chạy trên PGlite; cần người dùng Copy & Run file 002 trong project thật. Không có push GitHub hoặc deploy Vercel nào được thực hiện.

### Kết quả lần sửa khởi tạo dữ liệu mẫu (24/11/2026)

- `npm run build`: **PASS** sau thay đổi cuối cùng.
- `npm test`: **PASS**, 54 tests Vitest trong 7 files + 13 tests phân quyền PostgreSQL + 9 tests khởi tạo hệ thống, tổng **76 tests**.
- `node scripts/generate-system-seed.mjs --check`: **PASS**, file SQL bàn giao khớp dữ liệu thật trong seed.ts và template đã kiểm tra.
- Không có kiểm chứng Supabase cloud/website live: chưa có kết nối quản trị và môi trường bị lỗi DNS. Các khẳng định về bảo toàn dữ liệu/không trùng ở trên được kiểm chứng bằng migration chạy trong PostgreSQL PGlite với Auth/Storage schema tối thiểu.

### Sửa email xác nhận về localhost

- Đăng ký và gửi lại xác nhận truyền `redirect_to` về origin gốc của website; bỏ hash và query hiện tại.
- `npm run build`: PASS. `npm test`: PASS, 56 Vitest + 22 PostgreSQL = 78 tests.
- Chưa kiểm tra email thật hoặc thay Site URL/Redirect URLs trên project Supabase; cần lưu domain production trong Authentication → URL Configuration. Xem đầu docs/SUPABASE.md.


## Bản 003: sửa chung, xóa theo tác giả và trang đóng góp cá nhân

- `npm test`: PASS, **73 tests Vitest trong 12 files**, cùng **34 tests PostgreSQL** (13 baseline 001, 9 seed 002, 12 nâng cấp 003), tổng **107 tests**.
- Build sau các thay đổi source: PASS; migration 001/002 giữ nguyên, SQL generated 002 vẫn khớp seed.ts.
- Kiểm tra 003: RLS cả bốn bảng, Member sửa nội dung B/hệ thống, tự ghi updated_by/updated_at/revision, bất biến tác giả/ID/system key/parent, DELETE theo tác giả/Admin, từ chối tự cấp quyền, snapshot revision chống ghi đè kể cả ABA, rollback khi một thao tác không hợp lệ. Chạy lại 002 sau 003 vẫn giữ trigger audit, quyền và revision.
- UI: Member sửa tên nội dung người khác nhưng không có nút xóa; thiếu 003 hoặc mẫu chưa đồng bộ thì chỉ đọc và có hướng dẫn. Nút sửa từ trang cá nhân mở đúng editor; xem chi tiết mở nội dung thật.
- Trang cá nhân: nội dung sửa hộ không được tính là do mình tạo; thống kê và lọc theo created_by, empty state có CTA, tài nguyên của mình trên hoạt động người khác xuất hiện đúng tab; tab quản trị tách riêng và hỗ trợ bàn phím.
- Storage UI: đếm ảnh từ truy vấn thật, không giả số 0 khi lỗi; thumbnail, mở/xóa ảnh, retry; không lưu dở dang trong lúc upload và giữ tác giả gốc khi thay URL ảnh.
- Responsive CSS đã cấu hình cho desktop, tablet và điện thoại; **chưa kiểm chứng bằng trình duyệt/điện thoại thật**. Môi trường từng chặn Chromium bởi sandbox, không có kiểm thử ảnh chụp giao diện thực tế cho bản này.
- **Chưa chạy SQL trên Supabase cloud, chưa gửi dữ liệu lên website thật hoặc thử đồng bộ qua hai thiết bị thật** do không có phiên quản trị/cấu hình project trong môi trường này. PostgreSQL/RLS được kiểm tra bằng PGlite; HTTP Auth/Storage dùng mock ở unit/DOM tests. Cần chạy 003 trong Dashboard rồi thực hiện checklist thật bằng A/B/Admin.
- Không push GitHub hoặc deploy Vercel. Danh sách file mới/sửa được ghi trong CAC_FILE_CAN_UPLOAD.md.
