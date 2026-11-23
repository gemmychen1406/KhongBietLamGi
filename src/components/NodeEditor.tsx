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
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  function patch(index: number, value: Partial<Resource>) {
    onChange(resources.map((r, i) => (i === index ? { ...r, ...value } : r)));
  }
  return (
    <div className="resource-editor">
      {resources.map((r, i) => (
        <fieldset className="nested-card" key={r.id}>
          <legend>Tài nguyên {i + 1}</legend>
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
          <button
            type="button"
            className="text-button danger"
            onClick={() =>
              onChange(resources.filter((_, index) => index !== i))
            }
          >
            <Trash2 size={15} /> Xóa tài nguyên
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button small secondary"
        onClick={() => onChange([...resources, newResource()])}
      >
        <Link2 size={16} /> Thêm tài nguyên
      </button>
    </div>
  );
}
function VariantEditor({
  variant,
  onChange,
  onDelete,
}: {
  variant: Variant;
  onChange: (value: Variant) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
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
        <button
          type="button"
          className="icon-button danger"
          aria-label={`Xóa biến thể ${variant.title || "mới"}`}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
      {open && (
        <div className="variant-body">
          <label>
            Tên biến thể *
            <input
              required
              maxLength={500}
              value={variant.title}
              onChange={(e) => onChange({ ...variant, title: e.target.value })}
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
          <ResourceEditor
            resources={variant.resources}
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
  onSave: (node: ActivityNode) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [error, setError] = useState("");
  const close = useCallback(() => {
    if (
      JSON.stringify(node) === JSON.stringify(draft) ||
      window.confirm("Bỏ các thay đổi chưa lưu?")
    )
      onClose();
  }, [node, draft, onClose]);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = nodeSchema.parse(draft);
      const trimResources = (rs: Resource[]) =>
        rs.map((r) => ({
          ...r,
          title: r.title.trim(),
          ...(r.url?.trim() ? { url: r.url.trim() } : { url: undefined }),
        }));
      onSave({
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
      setError(readableError(e));
    }
  }
  return (
    <Modal
      wide
      title={`${isNew ? "Thêm" : "Chỉnh sửa"} ${node.kind === "group" ? "nhóm" : "hoạt động"}`}
      onClose={close}
    >
      <form onSubmit={save} className="editor-form">
        <p className="muted">Vị trí: {parentName}</p>
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
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />{" "}
          Cho phép random{" "}
          {draft.kind === "group"
            ? "nhóm này và các nhánh con"
            : "hoạt động này"}
        </label>
        {draft.kind === "activity" && (
          <>
            <section className="editor-section">
              <h3>
                <FileText size={18} /> Biến thể{" "}
                <span className="count">{draft.variants.length}</span>
              </h3>
              <p className="muted">
                Mỗi lần chọn hoạt động sẽ chọn một biến thể. Tài nguyên riêng đi
                theo đúng biến thể đó.
              </p>
              {draft.variants.map((v) => (
                <VariantEditor
                  key={v.id}
                  variant={v}
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
              <button
                type="button"
                className="button small secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    variants: [
                      ...draft.variants,
                      { id: id(), title: "", description: "", resources: [] },
                    ],
                  })
                }
              >
                <Plus size={16} /> Thêm biến thể
              </button>
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
          <button type="submit" className="button primary">
            Lưu thay đổi
          </button>
        </footer>
      </form>
    </Modal>
  );
}
