# Hôm nay làm gì nhỉ?

Website tiếng Việt React + Vite + TypeScript, random hoạt động theo cây không giới hạn tầng, thư viện cộng đồng dùng Supabase Auth/PostgreSQL/Storage. Giao diện pastel và logic random hiện có được giữ lại.

**Bắt đầu:** làm theo [hướng dẫn Supabase](docs/SUPABASE.md) để chạy migration, cấu hình Auth, tạo Admin đầu tiên, nhập dữ liệu cũ và đặt biến Vercel. Không có Supabase thì website hiển thị trạng thái chưa cấu hình, không dùng localStorage thay thư viện chung.

## Chạy local và kiểm tra

Node theo `engines` trong package.json (khuyến nghị Node 24). Tạo `.env.local` từ `.env.example` với URL và public publishable key của project.

```bash
npm ci
npm run dev
npm run build
npm test
```

`npm test` chạy utilities/DOM và PostgreSQL cục bộ qua PGlite. `npm run test:db` chỉ chạy kiểm tra database. PGlite dùng schema Auth/Storage tối thiểu để thực thi migration và RLS; không thay thế kiểm tra Auth/email/Storage HTTP trên project Supabase thật. Xem [KIEM_THU.md](KIEM_THU.md).

## Sử dụng

- **Guest:** xem cây, mở chi tiết/tài nguyên, random và lưu lịch sử cá nhân; đăng nhập để đóng góp.
- **Member:** thêm nhóm, nhánh và hoạt động; thêm variant/tài nguyên vào hoạt động của bất kỳ tác giả nào; sửa/xóa đúng đóng góp của mình.
- **Admin:** quản lý mọi đóng góp và ảnh, quản lý vai trò tại **Đóng góp của tôi**. Quyền được database kiểm tra ở từng thao tác.
- Random đều giữa các hoạt động lá còn hiệu lực, tôn trọng nhánh cha đã tắt; random lại từ một tầng giữ nguyên prefix; tài nguyên theo đúng variant.
- Mỗi lượt random tự lưu snapshot vào lịch sử; có thể đánh dấu hoàn thành và xóa sau xác nhận. Xóa/sửa node không làm đổi snapshot đã lưu.
- Không thể xóa nội dung còn phụ thuộc. Xóa từng tài nguyên/biến thể/nhánh con theo quyền trước; FK không cascade.
- Thư viện tải từ Supabase khi mở/reload hoặc bấm **Tải lại thư viện**. Lịch sử nằm trong localStorage của thiết bị; không có backend riêng hay đồng bộ lịch sử cá nhân.

## Backup JSON và nâng cấp

**Sao lưu dữ liệu** xuất thư viện đang tải và lịch sử cá nhân. Nhập JSON có preview/xác nhận, thêm bản sao nội dung vào cộng đồng với ID mới và tác giả là tài khoản đang nhập; thay lịch sử cá nhân trên thiết bị. Không có chức năng ghi đè/reset toàn bộ cộng đồng. Admin có thể thêm bản sao dữ liệu mẫu bằng nút trong thư viện.

Khóa localStorage cũ không bị ghi đè. Dùng **Tải bản gốc trước nâng cấp** để lấy JSON cũ rồi import; lịch sử hợp lệ được chuyển sang khóa cá nhân mới. Khi không đọc được dữ liệu, giữ nguyên bản gốc và báo lỗi. Backup JSON không chứa file ảnh hoặc tài khoản; cần backup Storage riêng nếu muốn bảo toàn byte ảnh.

## File cần upload qua GitHub Web

Upload `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `README.md`, `AGENTS.md`, `CODEX_PROMPT.md`, `KIEM_THU.md`, cùng các thư mục `src/`, `public/`, `supabase/`, `docs/`, `tests/`. Có thể giữ `CHAY_THU.cmd` nếu đang dùng.

Không upload `node_modules/`, `dist/`, `.git/`, `.local/`, `.env.local`, `.env` hay secret. Nếu GitHub giới hạn 100 file/lần, upload lần lượt từng thư mục. Dùng **Add file → Create new file** để tạo các file bắt đầu bằng dấu chấm nếu trình chọn file ẩn chúng.

Trên GitHub: tạo repository → **Add file → Upload files** → kiểm tra danh sách → **Commit changes** trên web. Trên Vercel: import repository → Vite → đặt hai biến công khai theo `.env.example` → Build `npm run build`, Output `dist` → bạn tự Deploy. Chi tiết và thứ tự thiết lập tại [docs/SUPABASE.md](docs/SUPABASE.md). Codex không tự push/deploy.
