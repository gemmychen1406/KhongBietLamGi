import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Trash2,
  ChevronDown,
  ChevronUp,
  History,
  Shuffle,
} from "lucide-react";
import type { AppDocument } from "../types";
import { Resources } from "../components/Resources";
export function HistoryPage({
  doc,
  onChange,
  goRandom,
}: {
  doc: AppDocument;
  onChange: (doc: AppDocument) => void;
  goRandom: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string[]>([]);
  const [limit, setLimit] = useState(30);
  const completed = doc.history.filter((h) => h.completed).length;
  const entries = doc.history.filter(
    (h) => filter === "all" || (filter === "done" ? h.completed : !h.completed),
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">NHỮNG ĐIỀU ĐÃ KHÁM PHÁ</div>
          <h1>
            Mỗi ngày, <span>một dấu ấn.</span>
          </h1>
          <p>Mỗi lượt random được tự lưu, cùng nội dung tại thời điểm đó.</p>
        </div>
        <button className="button secondary" onClick={goRandom}>
          <Shuffle size={17} /> Thêm một trải nghiệm
        </button>
      </section>
      <div className="history-stats">
        <div className="panel history-stat">
          <span className="stat-icon lavender">
            <History size={23} />
          </span>
          <div>
            <strong>{doc.history.length}</strong>
            <span>Lượt random</span>
          </div>
        </div>
        <div className="panel history-stat">
          <span className="stat-icon mint">
            <CheckCircle2 size={23} />
          </span>
          <div>
            <strong>{completed}</strong>
            <span>Đã hoàn thành</span>
          </div>
        </div>
        <div className="panel history-stat">
          <span className="stat-icon peach">
            <Clock3 size={23} />
          </span>
          <div>
            <strong>{doc.history.length - completed}</strong>
            <span>Đang chờ bạn thử</span>
          </div>
        </div>
      </div>
      <section className="panel history-panel">
        <div className="history-toolbar">
          <div className="filters">
            {[
              ["all", "Tất cả"],
              ["pending", "Chưa hoàn thành"],
              ["done", "Đã hoàn thành"],
            ].map(([value, label]) => (
              <button
                className={`filter ${filter === value ? "selected" : ""}`}
                aria-pressed={filter === value}
                key={value}
                onClick={() => {
                  setFilter(value);
                  setLimit(30);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="text-button danger"
            disabled={!doc.history.length}
            onClick={() => {
              if (
                window.confirm(
                  "Xóa toàn bộ lịch sử? Thao tác này không thể hoàn tác.",
                )
              )
                onChange({ ...doc, history: [] });
            }}
          >
            <Trash2 size={15} /> Xóa lịch sử
          </button>
        </div>
        {entries.slice(0, limit).map((entry) => {
          const expanded = open.includes(entry.id);
          return (
            <article key={entry.id} className="history-entry">
              <div className="history-entry-top">
                <button
                  className={`completion ${entry.completed ? "done" : ""}`}
                  aria-label={`${entry.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}: ${entry.result.activity.title}`}
                  aria-pressed={entry.completed}
                  onClick={() =>
                    onChange({
                      ...doc,
                      history: doc.history.map((h) =>
                        h.id === entry.id
                          ? { ...h, completed: !h.completed }
                          : h,
                      ),
                    })
                  }
                >
                  <Check size={18} />
                </button>
                <button
                  className="history-summary"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpen(
                      expanded
                        ? open.filter((v) => v !== entry.id)
                        : [...open, entry.id],
                    )
                  }
                >
                  <span className="history-path">
                    {entry.result.path
                      .slice(0, -1)
                      .map((n) => n.title)
                      .join(" › ")}
                  </span>
                  <h3>{entry.result.activity.title}</h3>
                  {entry.result.source === "sample" && (
                    <small>Mẫu cục bộ · Chưa đồng bộ</small>
                  )}
                  {entry.result.variant && (
                    <span className="history-variant">
                      {entry.result.variant.title}
                    </span>
                  )}
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  </time>
                </button>
                <div className="history-actions">
                  <span className={`pill ${entry.completed ? "green" : ""}`}>
                    {entry.completed ? "Hoàn thành" : "Chưa thử"}
                  </span>
                  <button
                    className="icon-button"
                    aria-expanded={expanded}
                    aria-label={`Xem nội dung ${entry.result.activity.title}`}
                    onClick={() =>
                      setOpen(
                        expanded
                          ? open.filter((v) => v !== entry.id)
                          : [...open, entry.id],
                      )
                    }
                  >
                    {expanded ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Xóa bản ghi ${entry.result.activity.title}`}
                    onClick={() => {
                      if (window.confirm("Xóa bản ghi lịch sử này?"))
                        onChange({
                          ...doc,
                          history: doc.history.filter((h) => h.id !== entry.id),
                        });
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="history-detail">
                  <p className="preserve">
                    {entry.result.activity.description || "Không có mô tả."}
                  </p>
                  {entry.result.variant && (
                    <div className="variant-result">
                      <h4>{entry.result.variant.title}</h4>
                      <p className="preserve">
                        {entry.result.variant.description}
                      </p>
                      <Resources resources={entry.result.variant.resources} />
                    </div>
                  )}
                  <Resources resources={entry.result.activity.resources} />
                  <small className="subtle">
                    Đây là bản lưu độc lập, giữ nguyên khi hoạt động gốc được
                    sửa hoặc xóa.
                  </small>
                </div>
              )}
            </article>
          );
        })}
        {!entries.length && (
          <div className="empty-state">
            <History size={36} />
            <h3>
              {doc.history.length
                ? "Chưa có lượt nào ở trạng thái này"
                : "Hành trình của bạn bắt đầu từ đây"}
            </h3>
            <p>
              Thử random một hoạt động. Những ý tưởng đã chọn sẽ xuất hiện ở
              đây.
            </p>
            <button className="button primary" onClick={goRandom}>
              <Shuffle size={17} /> Khám phá ngay
            </button>
          </div>
        )}
        {entries.length > limit && (
          <div className="load-more">
            <button
              className="button secondary"
              onClick={() => setLimit(limit + 30)}
            >
              Xem thêm 30 lượt
            </button>
          </div>
        )}
      </section>
    </>
  );
}
