import { useCallback } from "react";
import { Folder, Pencil } from "lucide-react";
import type { ActivityNode } from "../types";
import { usePermissions, canEdit } from "../services/permissions";
import { Modal } from "./Modal";
import { Resources } from "./Resources";
export function ActivityDetails({
  node,
  path,
  onClose,
  onEdit,
}: {
  node: ActivityNode;
  path: string[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const permissions = usePermissions();
  const close = useCallback(onClose, [onClose]);
  return (
    <Modal title={node.title} onClose={close} wide>
      <div className="activity-details">
        <p className="contribution-path">{path.join(" › ")}</p>
        <p className="muted">
          Đóng góp: {node.contributorName ?? "Thành viên"}
        </p>
        {node.description && <p className="preserve">{node.description}</p>}
        {node.kind === "group" && (
          <ul className="details-children">
            {node.children.map((child) => (
              <li key={child.id}>
                <Folder size={16} />
                {child.title}
              </li>
            ))}
          </ul>
        )}
        <Resources resources={node.resources} />
        {node.variants.map((v) => (
          <section className="variant-result" key={v.id}>
            <h3>{v.title}</h3>
            {v.description && <p className="preserve">{v.description}</p>}
            <Resources resources={v.resources} />
          </section>
        ))}
        <footer className="modal-actions">
          <button className="button secondary" onClick={close}>
            Đóng
          </button>
          {canEdit(permissions, node) && (
            <button className="button primary" onClick={onEdit}>
              <Pencil size={16} />
              Chỉnh sửa
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
