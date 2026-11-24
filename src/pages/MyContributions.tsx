import { ImageManager } from "../components/ImageManager";
import type { ActivityNode } from "../types";
import { usePermissions } from "../services/permissions";
export function MyContributions({
  nodes,
  onOpenLibrary,
}: {
  nodes: ActivityNode[];
  onOpenLibrary: () => void;
}) {
  const { userId } = usePermissions();
  const entries: { id: string; title: string; context: string }[] = [];
  function visit(ns: ActivityNode[], prefix: string) {
    ns.forEach((n) => {
      const path = `${prefix}${n.title}`;
      if (n.createdBy === userId)
        entries.push({
          id: n.id,
          title: n.title,
          context: n.kind === "group" ? "Nhóm" : "Hoạt động",
        });
      n.resources.forEach((r) => {
        if (r.createdBy === userId)
          entries.push({
            id: r.id,
            title: r.title,
            context: `Tài nguyên · ${path}`,
          });
      });
      n.variants.forEach((v) => {
        if (v.createdBy === userId)
          entries.push({
            id: v.id,
            title: v.title,
            context: `Biến thể · ${path}`,
          });
        v.resources.forEach((r) => {
          if (r.createdBy === userId)
            entries.push({
              id: r.id,
              title: r.title,
              context: `Tài nguyên · ${path} → ${v.title}`,
            });
        });
      });
      visit(n.children, `${path} → `);
    });
  }
  if (userId) visit(nodes, "");
  return (
    <section className="panel">
      <h1>Đóng góp của tôi</h1>
      {!userId ? (
        <p>Hãy đăng nhập để xem các đóng góp của bạn.</p>
      ) : (
        <>
          <p>
            {entries.length} đóng góp. Mở thư viện, tìm theo tên rồi chọn chi
            tiết để sửa hoặc xóa theo quyền.
          </p>
          <ul>
            {entries.map((e) => (
              <li key={e.id}>
                <strong>{e.title}</strong>
                <p className="muted">{e.context}</p>
              </li>
            ))}
          </ul>
          <button className="button secondary" onClick={onOpenLibrary}>
            Mở thư viện
          </button>
          <ImageManager />
        </>
      )}
    </section>
  );
}
