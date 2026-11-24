import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Plus,
  Folder,
  FileText,
  Layers3,
  Link2,
  Image,
  Sparkles,
  ArrowUpRight,
  Pencil,
  ExternalLink,
  ShieldCheck,
  UserRound,
  BookOpen,
} from "lucide-react";
import type { ActivityNode, Resource } from "../types";
import {
  usePermissions,
  canContribute,
  canEdit,
} from "../services/permissions";
import { configured } from "../services/supabase";
import { isSafeUrl } from "../services/storage";
import { collectContributions, contributionDate } from "../utils/contributions";
import { useUploadedImages } from "../hooks/useUploadedImages";
import { ImageManager } from "../components/ImageManager";
import { ImagePreview } from "../components/ImagePreview";
import { ActivityDetails } from "../components/ActivityDetails";
type Tab = "activities" | "content" | "images" | "admin";
function ResourcePreview({ resource }: { resource: Resource }) {
  if (resource.type === "image" && resource.url && isSafeUrl(resource.url))
    return (
      <div className="contribution-thumbnail">
        <ImagePreview url={resource.url} title={resource.title} />
      </div>
    );
  if (resource.type === "text")
    return <p className="contribution-excerpt">{resource.content}</p>;
  return resource.url && isSafeUrl(resource.url) ? (
    <a
      className="contribution-resource-url"
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {resource.url}
      <ExternalLink size={13} />
    </a>
  ) : null;
}
export function MyContributions({
  nodes,
  onOpenLibrary,
  adminPanel,
}: {
  nodes: ActivityNode[];
  onOpenLibrary: (nodeId?: string) => void;
  adminPanel?: ReactNode;
}) {
  const permissions = usePermissions();
  const { userId, admin } = permissions;
  const entries = useMemo(
    () => collectContributions(nodes, userId),
    [nodes, userId],
  );
  const images = useUploadedImages(userId, configured);
  const [selectedTab, setSelectedTab] = useState<Tab>("activities");
  const [viewing, setViewing] = useState<{
    node: ActivityNode;
    path: string[];
  } | null>(null);
  const tab = selectedTab === "admin" && !admin ? "activities" : selectedTab;
  const total =
    entries.nodes.length + entries.variants.length + entries.resources.length;
  const activities = entries.nodes.filter(
    (e) => e.node.kind === "activity",
  ).length;
  const groups = entries.nodes.length - activities;
  const tabs: {
    id: Tab;
    label: string;
    icon: typeof FileText;
    count?: number;
  }[] = [
    {
      id: "activities",
      label: "Hoạt động của tôi",
      icon: FileText,
      count: entries.nodes.length,
    },
    {
      id: "content",
      label: "Chủ đề và tài nguyên",
      icon: Layers3,
      count: entries.variants.length + entries.resources.length,
    },
    {
      id: "images",
      label: "Ảnh đã tải lên",
      icon: Image,
      count: images.loaded ? images.files.length : undefined,
    },
    ...(admin
      ? [{ id: "admin" as const, label: "Quản trị", icon: ShieldCheck }]
      : []),
  ];
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setSelectedTab(tabs[next].id);
    document.getElementById(`contribution-tab-${tabs[next].id}`)?.focus();
  }
  const empty = (
    <div className="contribution-empty">
      <span className="empty-illustration">
        <Sparkles size={29} />
      </span>
      <h2>
        {total === 0
          ? "Bạn chưa có đóng góp nào"
          : tab === "activities"
            ? "Bạn chưa tạo hoạt động nào"
            : "Bạn chưa thêm chủ đề hoặc tài nguyên"}
      </h2>
      <p>Hãy chia sẻ hoạt động hoặc ý tưởng đầu tiên của bạn với cộng đồng.</p>
      <button className="button secondary" onClick={() => onOpenLibrary()}>
        <BookOpen size={16} />
        Khám phá thư viện
      </button>
    </div>
  );
  return (
    <div className="contributions-page">
      <header className="contributions-heading">
        <div>
          <span className="eyebrow">GÓC CHIA SẺ</span>
          <h1>Đóng góp của tôi</h1>
          <p>Những ý tưởng và tài nguyên bạn đã chia sẻ với cộng đồng.</p>
        </div>
        {canContribute(permissions) && (
          <button className="button primary" onClick={() => onOpenLibrary()}>
            <Plus size={17} />
            Thêm đóng góp
          </button>
        )}
      </header>
      {!userId ? (
        <section className="panel contribution-empty">
          <span className="empty-illustration">
            <UserRound size={27} />
          </span>
          <h2>Góc chia sẻ của riêng bạn</h2>
          <p>
            Hãy đăng nhập để xem các đóng góp của bạn. Bạn vẫn có thể khám phá
            và random mà không cần tài khoản.
          </p>
          <button className="button secondary" onClick={() => onOpenLibrary()}>
            Khám phá thư viện
          </button>
        </section>
      ) : (
        <>
          <section
            className="contribution-stats"
            aria-label="Thống kê đóng góp"
          >
            {[
              {
                title: "Hoạt động đã tạo",
                value: activities,
                note: groups
                  ? `Cùng ${groups} nhóm của bạn`
                  : "Những điều bạn muốn làm",
                icon: FileText,
                tone: "purple",
              },
              {
                title: "Chủ đề / biến thể",
                value: entries.variants.length,
                note: "Thêm một góc nhìn mới",
                icon: Layers3,
                tone: "green",
              },
              {
                title: "Tài nguyên đóng góp",
                value: entries.resources.length,
                note: "Chia sẻ để cùng khám phá",
                icon: Link2,
                tone: "peach",
              },
              {
                title: "Ảnh đã tải lên",
                value: images.loaded ? images.files.length : "—",
                note: images.loading
                  ? "Đang tải danh sách ảnh"
                  : images.error
                    ? "Chưa tải được số ảnh"
                    : "Ảnh trong thư mục của bạn",
                icon: Image,
                tone: "blue",
              },
            ].map(({ title, value, note, icon: Icon, tone }) => (
              <article className={`contribution-stat ${tone}`} key={title}>
                <span className="contribution-stat-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <span>{title}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </div>
              </article>
            ))}
          </section>
          {permissions.readOnly && (
            <p className="contribution-mode-note">
              {permissions.librarySource === "sample"
                ? "Bạn đang xem mẫu cục bộ chỉ đọc, chưa đồng bộ. Cần khởi tạo thư viện chung trước khi thêm hoặc sửa đóng góp."
                : "Thư viện đang tải hoặc chưa sẵn sàng chỉnh sửa. Các nút thêm/sửa sẽ khả dụng khi kết nối và cấu hình hoàn tất."}
            </p>
          )}
          <section className="panel contribution-workspace">
            <div
              className="contribution-tabs"
              role="tablist"
              aria-label="Các loại đóng góp"
            >
              {tabs.map(({ id, label, icon: Icon, count }, i) => (
                <button
                  role="tab"
                  key={id}
                  id={`contribution-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`contribution-panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setSelectedTab(id)}
                  onKeyDown={(event) => tabKeys(event, i)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {count !== undefined && <small>{count}</small>}
                </button>
              ))}
            </div>
            <div
              className="contribution-tab-content"
              role="tabpanel"
              id={`contribution-panel-${tab}`}
              aria-labelledby={`contribution-tab-${tab}`}
              tabIndex={0}
            >
              {tab === "activities" && (
                <>
                  <div className="contribution-section-heading">
                    <div>
                      <h2>Những ý tưởng mang dấu ấn của bạn</h2>
                      <p>
                        {entries.nodes.length} nhóm và hoạt động do bạn tạo. Nội
                        dung chỉ chỉnh sửa hộ không được tính ở đây.
                      </p>
                    </div>
                  </div>
                  {!entries.nodes.length ? (
                    empty
                  ) : (
                    <div className="contribution-grid">
                      {entries.nodes.map(({ node, path }) => (
                        <article className="contribution-card" key={node.id}>
                          <div className="contribution-card-title">
                            <span
                              className={`contribution-type-icon ${node.kind}`}
                            >
                              {node.kind === "group" ? (
                                <Folder size={20} />
                              ) : (
                                <FileText size={20} />
                              )}
                            </span>
                            <div>
                              <span className="contribution-type-label">
                                {node.kind === "group"
                                  ? "Nhóm hoạt động"
                                  : "Hoạt động"}
                              </span>
                              <h3>{node.title}</h3>
                            </div>
                            <span
                              className={`contribution-state ${node.enabled ? "" : "is-off"}`}
                            >
                              {node.enabled ? "Đang bật" : "Đã tắt"}
                            </span>
                          </div>
                          <p className="contribution-path">
                            {path.join(" › ")}
                          </p>
                          {node.description && (
                            <p className="contribution-excerpt">
                              {node.description}
                            </p>
                          )}
                          {contributionDate(node.createdAt) && (
                            <time dateTime={node.createdAt}>
                              Đã chia sẻ {contributionDate(node.createdAt)}
                            </time>
                          )}
                          <div className="contribution-card-actions">
                            <button
                              className="text-button"
                              onClick={() => setViewing({ node, path })}
                            >
                              Xem chi tiết
                              <ArrowUpRight size={15} />
                            </button>
                            {canEdit(permissions, node) && (
                              <button
                                className="button small secondary"
                                onClick={() => onOpenLibrary(node.id)}
                              >
                                <Pencil size={14} />
                                Chỉnh sửa
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
              {tab === "content" && (
                <>
                  <div className="contribution-section-heading">
                    <div>
                      <h2>Chủ đề và tài nguyên bạn chia sẻ</h2>
                      <p>
                        Bao gồm đóng góp trong hoạt động của bạn và của những
                        thành viên khác.
                      </p>
                    </div>
                  </div>
                  {!entries.variants.length && !entries.resources.length ? (
                    empty
                  ) : (
                    <div className="contribution-grid">
                      {entries.variants.map(({ variant, node, path }) => (
                        <article className="contribution-card" key={variant.id}>
                          <div className="contribution-card-title">
                            <span className="contribution-type-icon variant">
                              <Layers3 size={20} />
                            </span>
                            <div>
                              <span className="contribution-type-label">
                                Chủ đề / biến thể
                              </span>
                              <h3>{variant.title}</h3>
                            </div>
                          </div>
                          <p className="contribution-path">
                            {path.join(" › ")}
                          </p>
                          {variant.description && (
                            <p className="contribution-excerpt">
                              {variant.description}
                            </p>
                          )}
                          {contributionDate(variant.createdAt) && (
                            <time dateTime={variant.createdAt}>
                              {contributionDate(variant.createdAt)}
                            </time>
                          )}
                          <div className="contribution-card-actions">
                            <button
                              className="text-button"
                              onClick={() => setViewing({ node, path })}
                            >
                              Xem hoạt động
                              <ArrowUpRight size={15} />
                            </button>
                            {canEdit(permissions, variant) && (
                              <button
                                className="button small secondary"
                                onClick={() => onOpenLibrary(node.id)}
                              >
                                <Pencil size={14} />
                                Chỉnh sửa
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                      {entries.resources.map(({ resource, node, path }) => (
                        <article
                          className={`contribution-card resource-contribution ${resource.type}`}
                          key={resource.id}
                        >
                          <div className="contribution-card-title">
                            <span className="contribution-type-icon resource">
                              {resource.type === "image" ? (
                                <Image size={20} />
                              ) : resource.type === "text" ? (
                                <FileText size={20} />
                              ) : (
                                <Link2 size={20} />
                              )}
                            </span>
                            <div>
                              <span className="contribution-type-label">
                                {resource.type === "image"
                                  ? "Ảnh tham khảo"
                                  : resource.type === "text"
                                    ? "Văn bản"
                                    : resource.type === "music_sheet"
                                      ? "Bản nhạc / tab"
                                      : "Liên kết"}
                              </span>
                              <h3>{resource.title}</h3>
                            </div>
                          </div>
                          <ResourcePreview resource={resource} />
                          <p className="contribution-path">
                            {path.join(" › ")}
                          </p>
                          {contributionDate(resource.createdAt) && (
                            <time dateTime={resource.createdAt}>
                              {contributionDate(resource.createdAt)}
                            </time>
                          )}
                          <div className="contribution-card-actions">
                            <button
                              className="text-button"
                              onClick={() => setViewing({ node, path })}
                            >
                              Mở hoạt động
                              <ArrowUpRight size={15} />
                            </button>
                            {canEdit(permissions, resource) && (
                              <button
                                className="button small secondary"
                                onClick={() => onOpenLibrary(node.id)}
                              >
                                <Pencil size={14} />
                                Chỉnh sửa
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
              {tab === "images" && (
                <ImageManager
                  collection={images}
                  onOpenLibrary={() => onOpenLibrary()}
                />
              )}
              {tab === "admin" && admin && adminPanel}
            </div>
          </section>
        </>
      )}
      {viewing && (
        <ActivityDetails
          node={viewing.node}
          path={viewing.path}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const id = viewing.node.id;
            setViewing(null);
            onOpenLibrary(id);
          }}
        />
      )}
    </div>
  );
}
