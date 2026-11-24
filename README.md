# Hôm nay làm gì nhỉ?

Website tiếng Việt React + Vite + TypeScript, random hoạt động theo cây không giới hạn tầng, thư viện cộng đồng dùng Supabase Auth/PostgreSQL/Storage. Giao diện pastel và logic random hiện có được giữ lại.

**Nâng cấp quyền Member và trang cá nhân:** xem [CAP_NHAT_003.md](docs/CAP_NHAT_003.md), chạy file SQL 003 sau 002; danh sách file cần upload ở [CAC_FILE_CAN_UPLOAD.md](CAC_FILE_CAN_UPLOAD.md).

**Bắt đầu:** làm theo [hướng dẫn Supabase](docs/SUPABASE.md) để chạy migration, cấu hình Auth, tạo Admin đầu tiên, nhập dữ liệu cũ và đặt biến Vercel. Khi chưa kết nối, đang tải, lỗi mạng hoặc Supabase rỗng, khách vẫn chọn nhóm và random với dữ liệu mẫu cục bộ **chỉ đọc**, có nhãn **chưa đồng bộ**. Thư viện Supabase được ưu tiên khi tải thành công; không dùng localStorage làm thư viện chung.

## Sửa website hiện có: chỉ cần một lần Run trên Supabase

Project đã có 4 bảng và bucket: mở **SQL Editor → New query**, copy toàn bộ [002_system_seed.sql](supabase/migrations/002_system_seed.sql) rồi **Run**. Không chạy lại `001_community.sql`. Không cần tạo tài khoản hay đăng nhập Admin để có ba nhóm mẫu.

SQL mới kiểm tra lịch sử migration và schema thực tế, thêm 42 nhóm (gồm 3 nhóm gốc), 42 hoạt động, 17 biến thể, 4 tài nguyên lấy từ `src/data/seed.ts`. ID và khóa hệ thống cố định; chạy lại không thêm trùng, không ghi đè đóng góp hay khôi phục nội dung hệ thống đã được Admin sửa/xóa sau lần khởi tạo.

Quyền sở hữu hệ thống được phân biệt bằng `system_seed_key`; `created_by` chỉ được NULL với dữ liệu hệ thống hợp lệ. Nội dung thành viên vẫn bắt buộc có chủ sở hữu Auth. RLS chặn khách/thành viên tự tạo hoặc chiếm quyền dữ liệu hệ thống. Không tạo user giả, không dùng service role key trong frontend.

Sau đó chạy `003_collaborative_editing.sql` để bật quyền sửa chung và bảo vệ phiên bản bản ghi. Tiếp theo upload các file đã sửa qua GitHub Web và tải lại website khi bản mới được phát hành. Bộ mã vẫn giữ nguyên giao diện. Hướng dẫn ngắn ở đầu [docs/SUPABASE.md](docs/SUPABASE.md).

## Chạy local và kiểm tra

Node theo `engines` trong package.json (khuyến nghị Node 24). Tạo `.env.local` từ `.env.example` với URL và public publishable key của project.

```bash
npm ci
npm run dev
npm run build
npm test
```

`npm test` chạy utilities/DOM và PostgreSQL cục bộ qua PGlite. `npm run test:db` chạy kiểm tra database, gồm cả khởi tạo không trùng và bảo toàn dữ liệu thành viên. `npm test` còn kiểm tra SQL sinh ra khớp `seed.ts`. `npm run seed:generate` dành cho người phát triển khi chuẩn bị bản migration mẫu mới, không phải bước người dùng website cần chạy. PGlite dùng schema Auth/Storage tối thiểu để thực thi migration và RLS; không thay thế kiểm tra Auth/email/Storage HTTP trên project Supabase thật. Xem [KIEM_THU.md](KIEM_THU.md).

## Sử dụng

- **Guest:** xem cây, mở chi tiết/tài nguyên, random và lưu lịch sử cá nhân; đăng nhập để đóng góp.
- **Member:** thêm nhóm, nhánh và hoạt động; thêm variant/tài nguyên vào hoạt động của bất kỳ tác giả nào; sửa nội dung công khai của mọi tác giả (kể cả hệ thống), nhưng chỉ xóa nội dung chính mình tạo.
- **Admin:** quản lý mọi đóng góp và ảnh, quản lý vai trò tại **Đóng góp của tôi**. Quyền được database kiểm tra ở từng thao tác.
- Random đều giữa các hoạt động lá còn hiệu lực, tôn trọng nhánh cha đã tắt; random lại từ một tầng giữ nguyên prefix; tài nguyên theo đúng variant.
- Mỗi lượt random tự lưu snapshot vào lịch sử; có thể đánh dấu hoàn thành và xóa sau xác nhận. Xóa/sửa node không làm đổi snapshot đã lưu.
- Không thể xóa nội dung còn phụ thuộc. Xóa từng tài nguyên/biến thể/nhánh con theo quyền trước; FK không cascade.
- Thư viện tải từ Supabase khi mở/reload hoặc bấm **Tải lại thư viện**. Lịch sử nằm trong localStorage của thiết bị; không có backend riêng hay đồng bộ lịch sử cá nhân.

## Backup JSON và nâng cấp

**Sao lưu dữ liệu** xuất thư viện đang tải và lịch sử cá nhân. Nhập JSON có preview/xác nhận, thêm bản sao nội dung vào cộng đồng với ID mới và tác giả là tài khoản đang nhập; thay lịch sử cá nhân trên thiết bị. Không có chức năng ghi đè/reset toàn bộ cộng đồng. Dữ liệu mẫu chung được khởi tạo một lần bằng migration `002_system_seed.sql`, không cần đăng nhập Admin và không dùng nút thêm mẫu tạo bản sao.

Khóa localStorage cũ không bị ghi đè. Dùng **Tải bản gốc trước nâng cấp** để lấy JSON cũ rồi import; lịch sử hợp lệ được chuyển sang khóa cá nhân mới. Khi không đọc được dữ liệu, giữ nguyên bản gốc và báo lỗi. Backup JSON không chứa file ảnh hoặc tài khoản; cần backup Storage riêng nếu muốn bảo toàn byte ảnh.

## Quyền sửa chung và Đóng góp của tôi

Member được sửa nhóm, hoạt động, biến thể và tài nguyên của mọi người, nhưng chỉ xóa nội dung do mình tạo. Tác giả gốc giữ nguyên; database ghi người sửa gần nhất và revision. Bản sửa cũ không được ghi đè bản mới. Mẫu cục bộ hoặc database thiếu 003 vẫn chỉ đọc.

Trang cá nhân chỉ tính nội dung do tài khoản tạo, có card thống kê và ba tab hoạt động/chủ đề-tài nguyên/ảnh. Admin có tab quản trị riêng. Danh sách ảnh tự tải, có thumbnail và retry khi lỗi; lỗi truy vấn không bị tính là 0 ảnh.

## Cập nhật repository hiện tại

Với `gemmychen1406/KhongBietLamGi`, dùng **Add file → Upload files** để cập nhật `src/`, `scripts/`, `supabase/`, `tests/`, `docs/`, `package.json`, `package-lock.json`, `README.md`, `KIEM_THU.md`. Dùng nguyên cây thư mục, không sửa source bằng tay. Trên Supabase chỉ cần Run file SQL 002 như hướng dẫn ở trên. Codex chỉ chạy build local, không push hoặc deploy.

## File cần upload qua GitHub Web

Upload `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `README.md`, `AGENTS.md`, `CODEX_PROMPT.md`, `KIEM_THU.md`, cùng các thư mục `src/`, `public/`, `supabase/`, `scripts/`, `docs/`, `tests/`. Có thể giữ `CHAY_THU.cmd` nếu đang dùng.

Không upload `node_modules/`, `dist/`, `.git/`, `.local/`, `.env.local`, `.env` hay secret. Nếu GitHub giới hạn 100 file/lần, upload lần lượt từng thư mục. Dùng **Add file → Create new file** để tạo các file bắt đầu bằng dấu chấm nếu trình chọn file ẩn chúng.

Trên GitHub: tạo repository → **Add file → Upload files** → kiểm tra danh sách → **Commit changes** trên web. Trên Vercel: import repository → Vite → đặt hai biến công khai theo `.env.example` → Build `npm run build`, Output `dist` → bạn tự Deploy. Chi tiết và thứ tự thiết lập tại [docs/SUPABASE.md](docs/SUPABASE.md). Codex không tự push/deploy.
