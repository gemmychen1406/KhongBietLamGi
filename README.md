# Hôm nay làm gì nhỉ?

Ứng dụng cá nhân tiếng Việt giúp chọn ngẫu nhiên việc muốn làm và kiến thức muốn tìm hiểu. React + Vite + TypeScript, Lucide React, CSS thuần, Zod và localStorage. Không có backend, tài khoản, API key hoặc đồng bộ đám mây.

## Chạy thử trên Windows, không cần gõ lệnh

1. Cài **Node.js 24 LTS** từ trang chính thức https://nodejs.org nếu máy chưa có. Đóng và mở lại File Explorer sau khi cài nếu cần.
2. Trong thư mục dự án, nhấp đúp **`CHAY_THU.cmd`**.
3. File này tự chạy `npm ci`, sau đó khởi động Vite và mở trình duyệt tại **http://127.0.0.1:5173**. Lần cài dependencies cần Internet.
4. Giữ cửa sổ đó mở khi dùng. Để dừng, đóng cửa sổ hoặc nhấn Ctrl+C. Nếu báo cổng 5173 đang được sử dụng, đóng phiên chạy trước rồi thử lại.

Không mở trực tiếp `index.html` bằng nhấp đúp. Ứng dụng cần Vite hoặc một static host đã build.

Nếu muốn dùng terminal (không bắt buộc):

```bash
npm ci
npm run dev
```

Node được hỗ trợ: 22.12+ trong nhánh 22, nhánh 24, hoặc từ 26 trở lên. Khuyến nghị Node 24 cho cả local và Vercel. `npm run build` kiểm tra TypeScript và tạo `dist/`; `npm run preview` xem bản đã build; `npm test` chạy kiểm thử một lần.

## Cách sử dụng

### Random

- Chọn **Tất cả** hoặc một nhóm gốc; bộ lọc lấy trực tiếp từ thư viện của bạn.
- Bấm **Random ngay!**. Ứng dụng chọn đều giữa các **hoạt động lá đang có hiệu lực**, không chọn đều từng nhánh. Nhóm rỗng không phải kết quả. Tắt cha sẽ loại toàn bộ hậu duệ, dù công tắc của con vẫn bật.
- Nếu có từ hai hoạt động phù hợp, hoạt động vừa chọn được loại khỏi lượt ngay tiếp theo. Việc chống lặp này thay đổi xác suất có điều kiện của lượt kế tiếp; lần chọn đầu tiên vẫn đều trên toàn bộ lá hợp lệ.
- Hoạt động có biến thể sẽ nhận một biến thể, cùng đúng tài nguyên riêng của biến thể đó. Tài nguyên chung của hoạt động luôn được hiển thị.
- Bấm **↻ ở một cấp trên breadcrumb** để chọn lại từ cấp đó, giữ các cấp đứng trước. Bấm ở cấp lá để chọn hoạt động khác dưới cùng cha; nếu chỉ còn một lá, ứng dụng giữ lá đó và thử biến thể khác nếu có. Bấm cấp đầu hoặc **Random lại toàn bộ** để chọn lại trong bộ lọc hiện tại.
- Mỗi lượt random thành công, kể cả random lại, **tự lưu một bản ghi lịch sử**. Khi chỉ có 0 hoặc 1 lựa chọn, ứng dụng thông báo và không dùng vòng lặp tìm lại.
- Có thể đánh dấu hoàn thành ngay trên kết quả hoặc ở trang Lịch sử. Kết quả hiện tại được đặt lại khi đổi trang; các lượt đã lưu vẫn còn trong Lịch sử.

### Thư viện

- Bấm **Thêm nhóm mới** để tạo nhóm gốc.
- Mở nhóm bằng tên hoặc chevron. Bên phải mỗi nhóm có nút **thư mục +** để thêm nhóm con và nút **+** để thêm hoạt động.
- Dùng bút chì để sửa, nút nguồn để bật/tắt và thùng rác để xóa. Khi xóa nhánh, ứng dụng báo số nhóm và hoạt động bên trong rồi hỏi xác nhận.
- Nhóm chỉ chứa nhóm/hoạt động con. Hoạt động là lá, chứa mô tả, biến thể và tài nguyên; không có số cấp cố định trong mô hình dữ liệu.
- Trong editor, thêm/sửa/xóa biến thể và các tài nguyên của từng biến thể hoặc của hoạt động. Bấm **Lưu thay đổi** để áp dụng; Hủy/Escape sẽ hỏi bỏ thay đổi chưa lưu.
- Resource có bốn loại: văn bản (bắt buộc nội dung), ảnh, liên kết, bản nhạc/tab (bắt buộc URL http(s)). Tên không được để trống. Văn bản được hiển thị như văn bản thuần, không thực thi HTML. URL có tài khoản/mật khẩu, `javascript:`, `data:`, đường dẫn tương đối bị từ chối.
- Ảnh được lưu dưới dạng **URL**, có gallery và thông báo khi ảnh không tải được. Không tải file ảnh/Base64 vào bộ nhớ. Link ngoài mở tab mới với `noopener noreferrer`. Nút sao chép dùng Clipboard API; nếu trình duyệt không cho phép, chọn văn bản và sao chép thủ công.
- Tìm kiếm theo tên: giữ lại tổ tiên dẫn tới node phù hợp và tự mở đường dẫn. Các nhánh không có tên phù hợp được ẩn, dữ liệu không bị xóa. Nếu tên nhóm khớp nhưng tên con không khớp, chỉ nhóm đó hiện; xóa từ khóa để xem toàn bộ con.
- **Khôi phục dữ liệu mẫu** thay toàn bộ thư viện và xóa lịch sử sau khi xác nhận. Hãy xuất JSON trước nếu cần giữ dữ liệu.

### Lịch sử

Mỗi bản ghi có ID, thời gian ISO, trạng thái hoàn thành và **snapshot độc lập** gồm đường dẫn, hoạt động, biến thể và tài nguyên. Sửa/xóa node gốc không sửa lịch sử. Có bộ lọc trạng thái, xem chi tiết, xóa một lượt hoặc toàn bộ sau xác nhận. Lịch sử hiển thị 30 lượt mỗi đợt để tránh một trang quá dài.

## Dữ liệu mẫu

Ba nhóm **Nội trợ / Nghệ thuật / Kiến thức**, gồm các việc nhà ngắn, vẽ, tô màu, thiết kế, kalimba, thư pháp, viết văn và thủ công. Kiến thức có 7 lĩnh vực, mỗi lĩnh vực 3 nhóm nhỏ, với nội dung học và câu hỏi cụ thể. Huyền học được trình bày như văn hóa/lịch sử, có nội dung tư duy phản biện.

Thơ và đề bài sáng tạo ngắn được viết riêng cho dữ liệu mẫu. Không nhúng tác phẩm hoặc bản nhạc có bản quyền. Mẫu không phụ thuộc ảnh hay link ngoài; nơi chưa có nguồn hiện **“Chưa có tài liệu tham khảo”** hoặc lời nhắc tương ứng. Bạn có thể thêm tài liệu, 2–4 URL ảnh hoặc tab mình có quyền dùng qua Thư viện.

## Lưu dữ liệu và sao lưu JSON

- Khóa localStorage: `hom-nay-lam-gi.document`. Document gồm `schemaVersion: 1`, `nodes`, `history`, `settings`.
- Lần chạy đầu dùng seed; các lần sau đọc dữ liệu đã lưu. Cập nhật/deploy phiên bản ứng dụng không tự thay dữ liệu đang có.
- Tự lưu sau khi thay đổi. Nếu hết quota hoặc trình duyệt chặn lưu, ứng dụng hiện cảnh báo và giữ state trong phiên để bạn xuất JSON; không được coi là đã lưu bền vững cho tới khi hết cảnh báo.
- Nếu dữ liệu cũ hỏng hoặc có schemaVersion chưa hỗ trợ, ứng dụng **không ghi đè bản gốc**. Hiển thị mẫu tạm, có nút tải dữ liệu gốc và nhập bản sao hoặc xác nhận khôi phục mẫu. Không tự đoán cách migrate phiên bản chưa biết.
- Bấm **Sao lưu dữ liệu → Tải bản sao JSON** để tải toàn bộ document. Cất file ở nơi riêng an toàn, định kỳ và trước thao tác thay thế.
- Để khôi phục: chọn file JSON (tối đa 10 MB), xem số nhóm/hoạt động/lượt lịch sử, rồi bấm **Xác nhận khôi phục** và đồng ý hộp thoại. Dữ liệu sai cấu trúc, ID trùng hoặc URL không an toàn bị từ chối trước khi thay thế.
- Dữ liệu nằm riêng trên **từng trình duyệt, thiết bị và địa chỉ website**. `localhost`, `127.0.0.1`, URL preview và domain chính có bộ nhớ riêng. Muốn chuyển nơi sử dụng: xuất JSON từ nơi cũ rồi nhập ở nơi mới.
- Xóa dữ liệu trình duyệt, dùng chế độ riêng tư hoặc thay domain có thể làm bạn không thấy dữ liệu. **Không có đồng bộ tự động.** Nhiều tab cùng sửa có thể ghi đè nhau; nên chỉ chỉnh dữ liệu ở một tab.
- Khi trang đã tải, random, CRUD và lịch sử hoạt động không cần mạng. Ảnh/link tham khảo cần Internet. Chưa có service worker/PWA để đảm bảo tải lại lần đầu khi ngoại tuyến.

## Cấu trúc source

```text
src/
  types/                 Kiểu dữ liệu có version
  data/seed.ts           Dữ liệu mẫu
  utils/tree.ts          CRUD cây bất biến, tìm kiếm, thống kê
  utils/random.ts        Eligible leaves, chọn hoạt động/biến thể, random suffix
  services/storage.ts    Validation, localStorage, import/export
  components/            Modal, node/variant/resource editor, backup, resource viewer
  pages/                 Random, Thư viện, Lịch sử
  styles/index.css       Responsive, focus, reduced motion
  App.tsx                Điều hướng hash và quản lý document
  main.tsx               Entry React
public/favicon.svg       Icon cục bộ
 tests/                  Kiểm thử logic và luồng giao diện DOM
```

Điều hướng dùng hash `#random`, `#library`, `#history`, nên refresh không cần rewrite phía máy chủ. Logic cây/random là pure functions. localStorage được tách khỏi components để dễ thay bằng nơi lưu khác về sau.

## Kiểm thử

```bash
npm test
npm run build
```

`tests/core.test.ts`: nhánh tắt, nhóm rỗng, 0/1 lựa chọn, các khoảng xác suất theo lá ở độ sâu khác nhau, chống lặp, giữ prefix, tính hợp lệ của đường dẫn, variant/resources đúng chủ, CRUD bất biến, snapshot, round-trip JSON/reload, ID trùng, schema version và URL nguy hiểm.

`tests/ui.test.tsx`: random tự lưu/hoàn thành/reload; thêm nhóm con và hoạt động; thêm/sửa/xóa variant/resource; sửa/xóa cây; hủy xác nhận xóa; tắt nhánh; editor từ chối URL nguy hiểm; preview/import có xác nhận; giữ dữ liệu lỗi; thông báo quota.

Kết quả và giới hạn kiểm tra của lần bàn giao này nằm trong `KIEM_THU.md`.

## Upload source bằng GitHub Web

Không cần Git CLI hoặc VS Code.

1. Đăng nhập GitHub, chọn **New repository**, đặt tên `random-activity-web` rồi tạo repository.
2. Trong repository, chọn **Add file → Upload files** (hoặc liên kết upload ở trang repository trống).
3. Kéo **nội dung bên trong thư mục dự án** vào, giữ đúng cấu trúc. `package.json` phải nằm ngay ở gốc repository, không nằm thêm trong một thư mục bao ngoài.
4. Upload chính xác các mục dưới đây:

```text
.gitignore
AGENTS.md
CODEX_PROMPT.md
README.md
KIEM_THU.md
CHAY_THU.cmd
package.json
package-lock.json
index.html
tsconfig.json
vite.config.ts
public/         (toàn bộ)
src/            (toàn bộ)
tests/          (toàn bộ)
```

5. Chọn **Commit changes** trên giao diện GitHub để lưu các file bạn vừa upload. Đây là thao tác của bạn; Codex không tự tạo commit/push.
6. Nếu có giới hạn **100 file/lần**, chia upload theo đợt: file gốc + `public/`, tiếp theo `src/`, rồi `tests/`. Giữ đường dẫn thư mục. Dự án hiện nhỏ hơn giới hạn này. Có thể dùng GitHub Desktop nếu sau này dữ liệu source lớn hơn.
7. File `.gitignore` bị ẩn trong Explorer có thể bật **View → Show → Hidden items**, hoặc dùng **Add file → Create new file**, đặt tên `.gitignore` và chép nội dung từ file này.

**Không upload:** `node_modules/`, `dist/`, `.local/`, `.git/`, `.env*`, `*.tsbuildinfo`, `coverage/`, bản backup JSON cá nhân. Lưu ý: GitHub Web không tự lọc file theo `.gitignore`; phải tự chọn đúng các mục trên.

## Deploy Vercel bằng giao diện web

1. Đăng nhập Vercel, chọn thêm dự án mới và import repository GitHub đã upload. Cấp quyền cho đúng repository nếu được hỏi.
2. Chọn framework **Vite**. Root Directory là gốc có `package.json`.
3. Build Command: **`npm run build`**. Output Directory: **`dist`**. Install Command có thể để mặc định hoặc **`npm ci`**.
4. Chọn Node.js **24.x** trong thiết lập dự án nếu cần. Không cần biến môi trường hay API key.
5. Bạn bấm **Deploy**, chờ build thành công và mở domain Vercel trả về. Kiểm tra random, thêm thử một hoạt động, reload và xuất JSON.
6. Những lần sau, upload file source đã sửa vào đúng đường dẫn trên GitHub Web. Khi tích hợp GitHub được bật, Vercel sẽ build lại. Dữ liệu của trình duyệt ở cùng domain được giữ nguyên.

Codex chưa deploy website, chưa tạo repository, commit hoặc push.

### GitHub Pages (phương án phụ)

`base: './'` và điều hướng hash đã phù hợp đường dẫn repository. GitHub Pages không tự chạy Vite từ source: cần chạy `npm run build`, rồi đưa **nội dung** của `dist/` vào nhánh xuất bản riêng, thêm file `.nojekyll` trống và chọn nhánh đó ở **Settings → Pages**. Hoặc thiết lập GitHub Actions build và xuất bản `dist/`. Không upload `dist/` vào repository source của quy trình Vercel ở trên.

## Giới hạn có chủ đích

Chưa có các tính năng tùy chọn như di chuyển node sang cha khác, yêu thích, tài khoản hay cloud sync. Không giới hạn cấp trong schema nhưng cây cực sâu vẫn chịu giới hạn stack/render của trình duyệt. Lịch sử không tự cắt bỏ; khi localStorage gần đầy, sao lưu và chủ động xóa bớt lịch sử. Import giới hạn 10 MB; hạn mức localStorage thực tế phụ thuộc trình duyệt và có thể nhỏ hơn.
