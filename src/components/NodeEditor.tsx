import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Link2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ActivityNode, Resource, Variant } from "../types";
import { nodeSchema, readableError } from "../services/storage";
import { id } from "../utils/id";
import {
  usePermissions,
  canEdit,
  canDelete,
  canContribute,
} from "../services/permissions";
import { uploadImage } from "../services/community";
import { communityError } from "../services/supabase";
import { Modal } from "./Modal";
const newResource = (): Resource => ({
  id: id(),
  type: "text",
  title: "",
  content: "",
});
function ResourceEditor({
  resources,
  onChange,
  onUploadChange,
}: {
  onUploadChange?: (delta: number) => void;
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const permissions = usePermissions();
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  function patch(index: number, value: Partial<Resource>) {
    onChange(resources.map((r, i) => (i === index ? { ...r, ...value } : r)));
  }
  return (
    <div className="resource-editor">
      {resources.map((r, i) => (
        <fieldset className="nested-card" key={r.id}>
          <legend>
            Tài nguyên {i + 1} · {r.contributorName ?? "Bạn"}
          </legend>
          <fieldset
            disabled={!canEdit(permissions, r) || uploading}
            className="permission-fields"
          >
            <div className="form-row">
              <label>
                Loại
                <select
                  value={r.type}
                  onChange={(e) =>
                    patch(i, {
                      type: e.target.value as Resource["type"],
                      ...(e.target.value === "text" ? { url: undefined } : {}),
                    })
                  }
                >
                  <option value="text">Văn bản</option>
                  <option value="image">Ảnh (URL)</option>
                  <option value="link">Liên kết</option>
                  <option value="music_sheet">Bản nhạc / tab</option>
                </select>
              </label>
              <label>
                Tiêu đề
                <input
                  required
                  maxLength={500}
                  value={r.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
              </label>
            </div>
            {r.type !== "text" && (
              <label>
                URL http(s)
                <input
                  required
                  type="url"
                  placeholder="https://…"
                  value={r.url ?? ""}
                  onChange={(e) => patch(i, { url: e.target.value })}
                />
              </label>
            )}
            <label>
              {r.type === "text" ? "Nội dung *" : "Ghi chú (tùy chọn)"}
              <textarea
                required={r.type === "text"}
                value={r.content ?? ""}
                maxLength={100000}
                onChange={(e) => patch(i, { content: e.target.value })}
              />
            </label>
            {r.type === "image" &&
              canContribute(permissions) &&
              permissions.userId && (
                <label>
                  Tải ảnh lên (tối đa 5 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      onUploadChange?.(1);
                      setUploadError("");
                      try {
                        patch(i, {
                          url: await uploadImage(file, permissions.userId!),
                        });
                      } catch (error) {
                        setUploadError(communityError(error));
                      } finally {
                        setUploading(false);
                        onUploadChange?.(-1);
                      }
                    }}
                  />
                </label>
              )}
          </fieldset>
          {canDelete(permissions, r) && (
            <button
              type="button"
              className="text-button danger"
              onClick={() =>
                window.confirm("Xóa tài nguyên này?") &&
                onChange(resources.filter((_, index) => index !== i))
              }
            >
              <Trash2 size={15} /> Xóa tài nguyên
            </button>
          )}
        </fieldset>
      ))}
      {uploadError && <p role="alert">{uploadError}</p>}
      {uploading && <p role="status">Đang tải ảnh…</p>}
      {canContribute(permissions) && (
        <button
          type="button"
          disabled={uploading}
          className="button small secondary"
          onClick={() => onChange([...resources, newResource()])}
        >
          <Link2 size={16} /> Thêm tài nguyên
        </button>
      )}
    </div>
  );
}
function VariantEditor({
  variant,
  onChange,
  onDelete,
  onUploadChange,
}: {
  onUploadChange?: (delta: number) => void;
  variant: Variant;
  onChange: (value: Variant) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const permissions = usePermissions();
  return (
    <div className="variant-editor">
      <div className="variant-heading">
        <button
          type="button"
          className="text-button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{" "}
          {variant.title || "Biến thể mới"}
        </button>
        {canDelete(permissions, variant) && (
          <button
            type="button"
            className="icon-button danger"
            aria-label={`Xóa biến thể ${variant.title || "mới"}`}
            onClick={() => {
              if (variant.resources.length) {
                window.alert("Hãy xóa từng tài nguyên trước khi xóa biến thể.");
                return;
              }
              if (window.confirm("Xóa biến thể này?")) onDelete();
            }}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
      {open && (
        <div className="variant-body">
          <p className="muted">Đóng góp: {variant.contributorName ?? "Bạn"}</p>
          <fieldset
            disabled={!canEdit(permissions, variant)}
            className="permission-fields"
          >
            <label>
              Tên biến thể *
              <input
                required
                maxLength={500}
                value={variant.title}
                onChange={(e) =>
                  onChange({ ...variant, title: e.target.value })
                }
              />
            </label>
            <label>
              Mô tả / đề bài
              <textarea
                maxLength={100000}
                value={variant.description ?? ""}
                onChange={(e) =>
                  onChange({ ...variant, description: e.target.value })
                }
              />
            </label>
          </fieldset>
          <ResourceEditor
            resources={variant.resources}
            onUploadChange={onUploadChange}
            onChange={(resources) => onChange({ ...variant, resources })}
          />
        </div>
      )}
    </div>
  );
}
export function NodeEditor({
  node,
  isNew,
  parentName,
  onSave,
  onClose,
}: {
  node: ActivityNode;
  isNew: boolean;
  parentName: string;
  onSave: (node: ActivityNode) => void | Promise<void>;
  onClose: () => void;
}) {
  const permissions = usePermissions();
  const [saving, setSaving] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const uploadChange = useCallback(
    (delta: number) => setPendingUploads((n) => Math.max(0, n + delta)),
    [],
  );
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [error, setError] = useState("");
  const close = useCallback(() => {
    if (saving || pendingUploads) {
      setError("Đang lưu hoặc tải ảnh lên. Vui lòng đợi hoàn tất.");
      return;
    }
    if (
      JSON.stringify(node) === JSON.stringify(draft) ||
      window.confirm("Bỏ các thay đổi chưa lưu?")
    )
      onClose();
  }, [node, draft, onClose, saving, pendingUploads]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pendingUploads) {
      setError("Vui lòng đợi ảnh tải lên hoàn tất trước khi lưu.");
      return;
    }
    setSaving(true);
    try {
      const result = nodeSchema.parse(draft);
      const trimResources = (rs: Resource[]) =>
        rs.map((r) => ({
          ...r,
          title: r.title.trim(),
          ...(r.url?.trim() ? { url: r.url.trim() } : { url: undefined }),
        }));
      await onSave({
        ...result,
        title: result.title.trim(),
        resources: trimResources(result.resources),
        variants: result.variants.map((v) => ({
          ...v,
          title: v.title.trim(),
          resources: trimResources(v.resources),
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? readableError(e) : communityError(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      wide
      title={`${isNew ? "Thêm" : "Chi tiết / đóng góp"} ${node.kind === "group" ? "nhóm" : "hoạt động"}`}
      onClose={close}
    >
      <form onSubmit={save} className="editor-form">
        <fieldset
          disabled={saving || pendingUploads > 0}
          className="permission-fields"
        >
          <p className="muted">
            Vị trí: {parentName} · Đóng góp: {node.contributorName ?? "Bạn"}
          </p>
          {node.updatedAt && (
            <p className="muted editor-attribution">
              Sửa lần cuối: {node.updatedByName ?? "Thành viên"} ·{" "}
              {new Date(node.updatedAt).toLocaleString("vi-VN")}
            </p>
          )}
          <fieldset
            disabled={!canEdit(permissions, node)}
            className="permission-fields"
          >
            <label>
              Tên {node.kind === "group" ? "nhóm" : "hoạt động"} *
              <input
                autoFocus
                required
                maxLength={500}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Một ý tưởng mới…"
              />
            </label>
            <label>
              Mô tả / gợi ý bắt đầu
              <textarea
                maxLength={100000}
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />{" "}
              Cho phép random{" "}
              {draft.kind === "group"
                ? "nhóm này và các nhánh con"
                : "hoạt động này"}
            </label>
          </fieldset>
          {draft.kind === "activity" && (
            <>
              <section className="editor-section">
                <h3>
                  <FileText size={18} /> Biến thể{" "}
                  <span className="count">{draft.variants.length}</span>
                </h3>
                <p className="muted">
                  Mỗi lần chọn hoạt động sẽ chọn một biến thể. Tài nguyên riêng
                  đi theo đúng biến thể đó.
                </p>
                {draft.variants.map((v) => (
                  <VariantEditor
                    key={v.id}
                    variant={v}
                    onUploadChange={uploadChange}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        variants: draft.variants.map((item) =>
                          item.id === v.id ? value : item,
                        ),
                      })
                    }
                    onDelete={() =>
                      setDraft({
                        ...draft,
                        variants: draft.variants.filter(
                          (item) => item.id !== v.id,
                        ),
                      })
                    }
                  />
                ))}
                {canContribute(permissions) && (
                  <button
                    type="button"
                    className="button small secondary"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        variants: [
                          ...draft.variants,
                          {
                            id: id(),
                            title: "",
                            description: "",
                            resources: [],
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} /> Thêm biến thể
                  </button>
                )}
              </section>
              <section className="editor-section">
                <h3>
                  <Link2 size={18} /> Tài nguyên chung
                </h3>
                <p className="muted">
                  Hiển thị với mọi biến thể của hoạt động. Ảnh chỉ lưu URL.
                </p>
                <ResourceEditor
                  resources={draft.resources}
                  onUploadChange={uploadChange}
                  onChange={(resources) => setDraft({ ...draft, resources })}
                />
              </section>
            </>
          )}
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <footer className="modal-actions">
            <button type="button" className="button secondary" onClick={close}>
              Hủy
            </button>
            {canContribute(permissions) && (
              <button
                type="submit"
                className="button primary"
                disabled={saving || pendingUploads > 0}
              >
                {saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            )}
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
