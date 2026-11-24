import { useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Trash2,
  FolderSearch,
} from "lucide-react";
import { usePermissions } from "../services/permissions";
import {
  useUploadedImages,
  type ImageCollection,
} from "../hooks/useUploadedImages";
import { ImagePreview } from "./ImagePreview";
export function ImageManager({
  collection,
  onOpenLibrary,
}: {
  collection: ImageCollection;
  onOpenLibrary?: () => void;
}) {
  const { userId } = usePermissions();
  const { files, loading, loaded, error, deleting, reload, remove } =
    collection;
  if (!userId) return null;
  return (
    <section className="image-manager" aria-label="Ảnh đã tải lên">
      <div className="contribution-section-heading">
        <div>
          <h2>Thư viện ảnh của bạn</h2>
          <p>Ảnh đã tải lên, kể cả ảnh chưa gắn vào một hoạt động.</p>
        </div>
        <button
          className="button small secondary"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw size={15} />
          Tải lại ảnh
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="contribution-loading" role="status">
          Đang tải ảnh của bạn…
        </p>
      )}
      {!loading && loaded && !files.length && (
        <div className="contribution-empty compact">
          <span className="empty-illustration">
            <ImagePlus size={27} />
          </span>
          <h3>Bạn chưa tải ảnh nào</h3>
          <p>Thêm tài nguyên ảnh trong một hoạt động để bắt đầu bộ sưu tập.</p>
          {onOpenLibrary && (
            <button className="button secondary" onClick={onOpenLibrary}>
              Khám phá thư viện
            </button>
          )}
        </div>
      )}
      <div className="uploaded-image-grid">
        {files.map((image, index) => (
          <article className="uploaded-image-card" key={image.id}>
            <a
              className="uploaded-image-preview"
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ImagePreview
                url={image.url}
                title={`Ảnh đã tải lên ${index + 1}`}
              />
            </a>
            <div className="uploaded-image-info">
              <strong title={image.name}>Ảnh {index + 1}</strong>
              <span>
                {image.createdAt
                  ? new Date(image.createdAt).toLocaleDateString("vi-VN")
                  : "Ảnh đã tải lên"}
                {typeof image.size === "number"
                  ? ` · ${(image.size / 1024).toFixed(0)} KB`
                  : ""}
              </span>
              <small title={image.name}>{image.name}</small>
              <div className="contribution-card-actions">
                <a
                  className="text-button"
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở ảnh <ExternalLink size={14} />
                </a>
                <button
                  className="text-button danger"
                  disabled={Boolean(deleting)}
                  aria-label={`Xóa ảnh ${index + 1}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Xóa vĩnh viễn ảnh này? Những tài nguyên đang dùng liên kết này sẽ không còn tải được ảnh.",
                      )
                    )
                      void remove(image);
                  }}
                >
                  <Trash2 size={14} />
                  {deleting === image.id ? "Đang xóa…" : "Xóa ảnh"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function AdminImageManager() {
  const { admin } = usePermissions();
  const [draft, setDraft] = useState("");
  const [prefix, setPrefix] = useState<string | null>(null);
  const collection = useUploadedImages(prefix, admin);
  if (!admin) return null;
  return (
    <section className="admin-image-browser">
      <div className="contribution-section-heading">
        <div>
          <h2>Quản lý ảnh cộng đồng</h2>
          <p>Chọn thư mục thành viên để kiểm tra hoặc gỡ ảnh vi phạm.</p>
        </div>
        <FolderSearch size={21} />
      </div>
      <form
        className="admin-image-search"
        onSubmit={(event) => {
          event.preventDefault();
          setPrefix(draft.trim());
        }}
      >
        <label>
          UUID thành viên
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            required
            pattern="[0-9a-fA-F-]{36}"
            placeholder="UUID tài khoản cần quản lý"
          />
        </label>
        <button className="button secondary">Xem ảnh</button>
      </form>
      {prefix && <ImageManager collection={collection} />}
    </section>
  );
}
