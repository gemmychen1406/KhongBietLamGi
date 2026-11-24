import { Info, RefreshCw } from "lucide-react";
export function LibraryStatus({
  source,
  configured,
  loading,
  ready,
  error,
  onRefresh,
  editingReady = true,
}: {
  source: "sample" | "community";
  configured: boolean;
  loading: boolean;
  ready: boolean;
  error: string;
  onRefresh: () => void;
  editingReady?: boolean;
}) {
  const sample = source === "sample";
  const description = loading
    ? "Đang kết nối thư viện cộng đồng. Bạn vẫn có thể random các hoạt động đang hiển thị."
    : !configured
      ? "Chưa kết nối Supabase. Bạn đang xem dữ liệu mẫu đi kèm website; dữ liệu này chỉ đọc và chưa đồng bộ lên cộng đồng."
      : error
        ? sample
          ? "Chưa tải được cộng đồng. Bạn có thể tiếp tục random dữ liệu mẫu trên website."
          : "Đang giữ bản cộng đồng đã tải trước đó. Tạm khóa chỉnh sửa đến khi kết nối lại."
        : sample
          ? "Thư viện cộng đồng chưa có dữ liệu. Bạn có thể random mẫu; chủ website cần chạy 002_system_seed.sql rồi 003_collaborative_editing.sql trong Supabase SQL Editor để khởi tạo và bật đóng góp."
          : !editingReady
            ? "Thư viện đang dùng phân quyền cũ. Chủ website cần chạy 003_collaborative_editing.sql trong Supabase SQL Editor, sau đó tải lại. Nội dung vẫn xem và random được; tạm khóa thêm/sửa để bảo vệ dữ liệu."
            : "Hoạt động, biến thể và tài nguyên được tải từ thư viện chung. Đăng nhập để đóng góp; bấm tải lại để xem nội dung mới.";
  return (
    <section
      className={`library-status ${sample ? "is-sample" : "is-community"}`}
      aria-label="Trạng thái thư viện"
      aria-busy={loading}
    >
      <div className="library-status-label" role="status">
        <span
          className={`connection-dot ${loading ? "is-loading" : ""}`}
          aria-hidden="true"
        />
        <div>
          <strong>
            {loading
              ? "Đang tải thư viện…"
              : sample
                ? "Mẫu cục bộ"
                : "Thư viện cộng đồng"}
          </strong>
          <span>
            {sample
              ? "Chỉ đọc · Chưa đồng bộ"
              : !editingReady
                ? "Chỉ đọc · Cần cập nhật quyền"
                : ready && !loading
                  ? "Đã cập nhật"
                  : "Bản đã tải · Chỉ đọc"}
          </span>
        </div>
      </div>
      <div className="library-status-actions">
        <details
          className="library-status-details"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="Thông tin nguồn dữ liệu">
            <Info size={16} />
            <span>Chi tiết</span>
          </summary>
          <div className="library-status-popover">
            <strong>
              {sample
                ? "Dữ liệu mẫu cục bộ · Chỉ đọc · Chưa đồng bộ"
                : "Thư viện cộng đồng"}
            </strong>
            <p>{description}</p>
          </div>
        </details>
        {configured && (
          <button
            className="status-refresh"
            aria-label="Tải lại thư viện"
            title="Tải lại thư viện"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
