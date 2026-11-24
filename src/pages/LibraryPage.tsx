import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Power,
  ListTree,
  FileText,
  RotateCcw,
} from "lucide-react";
import type { ActivityNode, AppDocument } from "../types";
import {
  addNode,
  updateNode,
  removeNode,
  countNodes,
  matchesTree,
  findNode,
} from "../utils/tree";
import { id } from "../utils/id";
import {
  usePermissions,
  canEdit,
  canDelete,
  canContribute,
} from "../services/permissions";
import { communityError } from "../services/supabase";
import { NodeEditor } from "../components/NodeEditor";
interface Editing {
  node: ActivityNode;
  parentId: string | null;
  parentName: string;
  isNew: boolean;
  baseline: AppDocument;
}
function TreeItem({
  node,
  inherited = true,
  query,
  onEdit,
  onAdd,
  onToggle,
  onDelete,
}: {
  node: ActivityNode;
  inherited?: boolean;
  query: string;
  onEdit: (node: ActivityNode) => void;
  onAdd: (
    kind: ActivityNode["kind"],
    parentId: string,
    parentName: string,
  ) => void;
  onToggle: (node: ActivityNode) => void;
  onDelete: (node: ActivityNode) => void;
}) {
  const permissions = usePermissions();
  const [expanded, setExpanded] = useState(false);
  if (query && !matchesTree(node, query)) return null;
  const open = expanded || !!query;
  const enabled = inherited && node.enabled;
  return (
    <li className={`tree-item ${enabled ? "" : "disabled-node"}`}>
      <div className="tree-row">
        <button
          className="tree-name"
          onClick={() =>
            node.kind === "group" ? setExpanded(!expanded) : onEdit(node)
          }
          aria-expanded={node.kind === "group" ? open : undefined}
        >
          {node.kind === "group" ? (
            <>
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="folder-icon">
                {open ? <FolderOpen size={20} /> : <Folder size={20} />}
              </span>
            </>
          ) : (
            <>
              <span className="tree-spacer" />
              <span className="activity-icon">
                <FileText size={18} />
              </span>
            </>
          )}
          <span className="node-title">
            {node.title}
            <small>
              {node.kind === "group"
                ? `${countNodes(node.children).activities} hoạt động`
                : `${node.variants.length} biến thể · ${node.resources.length + node.variants.reduce((n, v) => n + v.resources.length, 0)} tài nguyên`}
              {node.contributorName && ` · ${node.contributorName}`}
              {!node.enabled
                ? " · Đã tắt"
                : !inherited
                  ? " · Nhóm cha đã tắt"
                  : ""}
            </small>
          </span>
        </button>
        <div className="tree-actions">
          {node.kind === "group" && canContribute(permissions) && (
            <>
              <button
                className="icon-button"
                title="Thêm nhóm con"
                aria-label={`Thêm nhóm con vào ${node.title}`}
                onClick={() => {
                  setExpanded(true);
                  onAdd("group", node.id, node.title);
                }}
              >
                <Folder size={16} />
                <Plus size={10} className="plus-overlay" />
              </button>
              <button
                className="icon-button"
                title="Thêm hoạt động"
                aria-label={`Thêm hoạt động vào ${node.title}`}
                onClick={() => {
                  setExpanded(true);
                  onAdd("activity", node.id, node.title);
                }}
              >
                <Plus size={18} />
              </button>
            </>
          )}
          {canEdit(permissions, node) && (
            <>
              <button
                className={`icon-button ${!node.enabled ? "off" : ""}`}
                aria-label={`${node.enabled ? "Tắt" : "Bật"} ${node.title}`}
                aria-pressed={node.enabled}
                title={node.enabled ? "Tắt nhánh" : "Bật nhánh"}
                onClick={() => onToggle(node)}
              >
                <Power size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={`Sửa ${node.title}`}
                title="Chỉnh sửa"
                onClick={() => onEdit(node)}
              >
                <Pencil size={16} />
              </button>
              {canDelete(permissions, node) && (
                <button
                  className="icon-button danger"
                  aria-label={`Xóa ${node.title}`}
                  title="Xóa"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </>
          )}
          {
            <button
              className="button small secondary"
              onClick={() => onEdit(node)}
            >
              {node.kind === "activity"
                ? "Chi tiết / Thêm tài nguyên"
                : "Chi tiết nhóm"}
            </button>
          }
        </div>
      </div>
      {node.kind === "group" && open && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              query={query}
              inherited={enabled}
              onEdit={onEdit}
              onAdd={onAdd}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
          {!node.children.length && (
            <li className="empty-branch">
              Nhóm còn trống. Dùng nút + để thêm hoạt động.
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
export function LibraryPage({
  doc,
  onChange,
  onReset,
  initialSelection,
  onSelectionHandled,
}: {
  doc: AppDocument;
  onChange: (doc: AppDocument, baseline?: AppDocument) => void | Promise<void>;
  onReset: () => void;
  initialSelection?: { nodeId: string; requestId: number } | null;
  onSelectionHandled?: () => void;
}) {
  const permissions = usePermissions();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(next: AppDocument, baseline?: AppDocument) {
    setBusy(true);
    setError("");
    try {
      await onChange(next, baseline);
    } catch (e) {
      setError(communityError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const close = useCallback(() => setEditing(null), []);
  useEffect(() => {
    if (!initialSelection) return;
    const node = findNode(doc.nodes, initialSelection.nodeId);
    if (node) {
      setQuery(node.title);
      setEditing({
        node,
        parentId: null,
        parentName: "Vị trí hiện tại (giữ nguyên)",
        isNew: false,
        baseline: doc,
      });
    } else
      setError(
        "Không tìm thấy nội dung; có thể nội dung đã được xóa. Hãy tải lại thư viện.",
      );
    onSelectionHandled?.();
  }, [initialSelection, doc, onSelectionHandled]);
  const counts = countNodes(doc.nodes);
  function add(
    kind: ActivityNode["kind"],
    parentId: string | null,
    parentName: string,
  ) {
    setEditing({
      node: {
        id: id(),
        title: "",
        kind,
        enabled: true,
        description: "",
        children: [],
        variants: [],
        resources: [],
      },
      parentId,
      parentName,
      isNew: true,
      baseline: doc,
    });
  }
  function remove(node: ActivityNode) {
    if (!canDelete(permissions, node)) {
      setError("Bạn chỉ được xóa nội dung do mình tạo.");
      return;
    }
    if (
      permissions.community &&
      (node.children.length || node.variants.length || node.resources.length)
    ) {
      setError(
        "Không thể xóa nội dung còn phụ thuộc. Hãy xóa từng nhánh con, biến thể và tài nguyên theo quyền của bạn trước.",
      );
      return;
    }
    const children = countNodes(node.children);
    if (
      window.confirm(
        `Xóa “${node.title}”${node.kind === "group" ? ` cùng ${children.groups} nhóm con và ${children.activities} hoạt động` : ""}? Lịch sử đã lưu vẫn được giữ nguyên.`,
      )
    )
      void change({ ...doc, nodes: removeNode(doc.nodes, node.id) }).catch(
        () => {},
      );
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">GÓC Ý TƯỞNG CỦA BẠN</div>
          <h1>
            Thư viện <span>hoạt động</span>
          </h1>
          <p>Chăm chút những điều muốn làm. Bắt đầu từ một ý tưởng nhỏ.</p>
        </div>
        {canContribute(permissions) && (
          <div className="error-actions">
            <button
              className="button secondary"
              onClick={() => add("activity", null, "Cấp cao nhất")}
            >
              Thêm hoạt động
            </button>
            <button
              className="button primary"
              onClick={() => add("group", null, "Cấp cao nhất")}
            >
              <Plus size={18} /> Thêm nhóm mới
            </button>
          </div>
        )}
      </section>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="permission-fields">
        <section className="panel library-panel">
          <div className="library-toolbar">
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Tìm hoạt động hoặc nhóm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm hoạt động hoặc nhóm…"
              />
              {query && (
                <button className="text-button" onClick={() => setQuery("")}>
                  Xóa
                </button>
              )}
            </div>
            <span className="subtle">
              <b>{counts.groups}</b> nhóm · <b>{counts.activities}</b> hoạt động
            </span>
          </div>
          <p className="tree-help">
            <ListTree size={16} />
            {query
              ? "Kết quả giữ lại các nhóm cha dẫn tới tên phù hợp; nhánh phù hợp được tự mở."
              : "Mở nhóm để xem nhánh con. Nút nguồn bật/tắt cả nhánh khi random."}
          </p>
          <ul className="tree-root">
            {doc.nodes.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                query={query.trim()}
                onEdit={(node) =>
                  setEditing({
                    node,
                    parentId: null,
                    parentName: "Vị trí hiện tại (giữ nguyên)",
                    isNew: false,
                    baseline: doc,
                  })
                }
                onAdd={add}
                onToggle={(node) =>
                  void change({
                    ...doc,
                    nodes: updateNode(doc.nodes, node.id, (n) => ({
                      ...n,
                      enabled: !n.enabled,
                    })),
                  }).catch(() => {})
                }
                onDelete={remove}
              />
            ))}
          </ul>
          {!doc.nodes.some((n) => matchesTree(n, query.trim())) && (
            <div className="empty-state">
              <Search size={30} />
              <h3>
                {doc.nodes.length
                  ? "Chưa tìm thấy ý tưởng này"
                  : "Thư viện đang chờ những ý tưởng đầu tiên"}
              </h3>
              <p>
                {doc.nodes.length
                  ? "Thử một tên khác hoặc thêm hoạt động mới vào nhóm."
                  : "Thêm một nhóm rồi tạo các hoạt động bên trong."}
              </p>
            </div>
          )}
          <div className="library-bottom">
            <span className="subtle">
              {permissions.librarySource === "sample"
                ? "Dữ liệu mẫu cục bộ · Chỉ đọc · Chưa đồng bộ."
                : permissions.community
                  ? "Thư viện công khai được lưu trên Supabase."
                  : "Thay đổi được tự lưu trên trình duyệt này."}
            </span>
            {!permissions.community && (
              <button className="text-button danger" onClick={onReset}>
                <RotateCcw size={15} /> Khôi phục dữ liệu mẫu
              </button>
            )}
          </div>
        </section>
      </fieldset>
      <p className="page-footnote">
        Nhóm chứa nhóm con hoặc hoạt động. Hoạt động là lá, có thể có nhiều biến
        thể và tài nguyên riêng.
      </p>
      {editing && (
        <NodeEditor
          node={editing.node}
          isNew={editing.isNew}
          parentName={editing.parentName}
          onClose={close}
          onSave={async (node) => {
            await change(
              {
                ...editing.baseline,
                nodes: editing.isNew
                  ? addNode(editing.baseline.nodes, editing.parentId, node)
                  : updateNode(editing.baseline.nodes, node.id, () => node),
              },
              editing.baseline,
            );
            close();
          }}
        />
      )}
    </>
  );
}
