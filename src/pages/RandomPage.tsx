import { useState } from "react";
import {
  Shuffle,
  Sparkles,
  Sprout,
  Palette,
  Lightbulb,
  RotateCcw,
  Check,
  BookOpen,
  Dice5,
  ChevronRight,
  Leaf,
  Clock3,
} from "lucide-react";
import type { AppDocument, Result } from "../types";
import { chooseResult, eligibleLeaves } from "../utils/random";
import { Resources } from "../components/Resources";
import { usePermissions } from "../services/permissions";
import { id } from "../utils/id";
export function RandomPage({
  doc,
  onChange,
  goLibrary,
}: {
  doc: AppDocument;
  onChange: (doc: AppDocument) => void;
  goLibrary: () => void;
}) {
  const { librarySource } = usePermissions();
  const [scope, setScope] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [entryId, setEntryId] = useState("");
  const [notice, setNotice] = useState("");
  const activeScope = doc.nodes.some((n) => n.id === scope) ? scope : "";
  const available = eligibleLeaves(doc.nodes).filter(
    (p) => !activeScope || p[0].id === activeScope,
  ).length;
  function random(fromLevel?: number) {
    const chosen = chooseResult(doc.nodes, {
      scopeId: activeScope || undefined,
      previous: result ?? undefined,
      fromLevel,
    });
    const next: Result | null = chosen
      ? { ...chosen, source: librarySource ?? "community" }
      : null;
    setResult(next);
    if (!next) {
      setNotice(
        "Chưa có hoạt động phù hợp. Hãy thêm hoặc bật một nhánh trong Thư viện.",
      );
      return;
    }
    const historyId = id();
    setEntryId(historyId);
    onChange({
      ...doc,
      history: [
        {
          id: historyId,
          createdAt: new Date().toISOString(),
          completed: false,
          result: next,
        },
        ...doc.history,
      ],
    });
    setNotice(
      available === 1
        ? "Chỉ có một hoạt động phù hợp. Nếu có nhiều biến thể, bạn vẫn có thể nhận một đề bài khác."
        : "Đã tự lưu lượt chọn này vào Lịch sử.",
    );
  }
  const entry = doc.history.find((h) => h.id === entryId);
  const icons = [Sprout, Palette, Lightbulb];
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">
          <span className="tiny-spark">✦</span> MỘT CHÚT NGẪU NHIÊN, MỘT NGÀY
          THÚ VỊ
        </div>
        <h1>
          Hôm nay, bạn muốn
          <br className="desktop-break" /> thử <span>điều gì mới?</span>
        </h1>
        <p>
          Để những ý tưởng nhỏ dẫn lối. Chọn một hoạt động,
          <br className="desktop-break" /> dành chút thời gian cho bản thân và
          bắt đầu thôi.
        </p>
      </section>
      <div className="random-layout">
        <div className="random-main">
          <section className="picker panel">
            <div className="section-label">
              <span>HÔM NAY MÌNH SẼ…</span>
              <span className="subtle">{available} lựa chọn phù hợp</span>
            </div>
            <div className="filters" aria-label="Lọc nhóm hoạt động">
              <button
                className={`filter ${!activeScope ? "selected" : ""}`}
                aria-pressed={!activeScope}
                onClick={() => {
                  setScope("");
                  setResult(null);
                  setNotice("");
                }}
              >
                <Sparkles size={16} /> Tất cả
              </button>
              {doc.nodes.map((n, i) => {
                const Icon = icons[i % icons.length];
                return (
                  <button
                    key={n.id}
                    className={`filter tone-${i % 3} ${activeScope === n.id ? "selected" : ""}`}
                    aria-pressed={activeScope === n.id}
                    onClick={() => {
                      setScope(n.id);
                      setResult(null);
                      setNotice("");
                    }}
                  >
                    <Icon size={16} />
                    {n.title}
                    {!n.enabled && " (đã tắt)"}
                  </button>
                );
              })}
            </div>
            <button
              className="button primary random-button"
              onClick={() => random()}
            >
              <Shuffle size={21} /> Random ngay! <Sparkles size={17} />
            </button>
            <p className="picker-note">
              <Clock3 size={14} /> Mỗi lượt chọn được tự động lưu vào Lịch sử
            </p>
          </section>
          <section
            className={`result-card panel ${result ? "has-result" : ""}`}
            aria-label="Kết quả random"
          >
            <div className="section-label">
              <span>
                <Sparkles size={15} /> GỢI Ý DÀNH CHO BẠN
              </span>
              {result && <span className="pill green">Đã lưu lịch sử</span>}
            </div>
            {result ? (
              <>
                <div className="breadcrumbs" aria-label="Đường dẫn kết quả">
                  {result.path.map((n, i) => (
                    <span key={n.id}>
                      {i > 0 && <ChevronRight size={12} />}
                      <button
                        type="button"
                        title={`Random lại từ cấp ${i + 1}: ${n.title}`}
                        aria-label={`Random lại từ cấp ${i + 1}: ${n.title}`}
                        onClick={() => random(i)}
                      >
                        {n.title}
                        <RotateCcw size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="result-title-icon">
                  <Leaf size={25} />
                </div>
                <h2>{result.activity.title}</h2>
                <small>
                  {result.source === "sample"
                    ? "Mẫu cục bộ · Chưa đồng bộ"
                    : "Dữ liệu cộng đồng"}
                </small>
                {result.activity.contributorName && (
                  <small>Đóng góp: {result.activity.contributorName}</small>
                )}
                <p className="preserve description">
                  {result.activity.description ||
                    "Hãy bắt đầu bằng một bước nhỏ theo cách của bạn."}
                </p>
                {result.variant && (
                  <div className="variant-result">
                    <div className="eyebrow">CHỦ ĐỀ LẦN NÀY</div>
                    <h3>{result.variant.title}</h3>
                    {result.variant.contributorName && (
                      <small>Đóng góp: {result.variant.contributorName}</small>
                    )}
                    {result.variant.description && (
                      <p className="preserve">{result.variant.description}</p>
                    )}
                    <Resources resources={result.variant.resources} />
                  </div>
                )}
                <Resources resources={result.activity.resources} />
                {!result.activity.resources.length &&
                  !result.variant?.resources.length && (
                    <p className="no-resource">
                      <BookOpen size={15} /> Chưa có tài liệu tham khảo. Bạn có
                      thể bổ sung trong Thư viện.
                    </p>
                  )}
                <div className="result-actions">
                  <button className="button secondary" onClick={() => random()}>
                    <RotateCcw size={16} /> Random lại toàn bộ
                  </button>
                  {entry && (
                    <button
                      className={`button ${entry.completed ? "completed-button" : "soft"}`}
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
                      <Check size={17} />
                      {entry.completed
                        ? "Đã hoàn thành"
                        : "Đánh dấu hoàn thành"}
                    </button>
                  )}
                </div>
                <p className="subtle reroll-hint">
                  Bấm biểu tượng ↻ trên từng cấp để giữ phần trước và chọn lại
                  từ cấp đó.
                </p>
              </>
            ) : (
              <div className="welcome-result">
                <div className="dice-scene" aria-hidden="true">
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <span className="floating-star star-one">✦</span>
                  <span className="floating-star star-two">✧</span>
                  <div className="dice-tile">
                    <Dice5 size={68} strokeWidth={1.35} />
                  </div>
                  <span className="scene-dot dot-one" />
                  <span className="scene-dot dot-two" />
                </div>
                <h2>
                  {available
                    ? "Một ý tưởng nhỏ, nhiều niềm vui."
                    : "Chưa có hoạt động phù hợp"}
                </h2>
                <p>
                  {available
                    ? "Có thể là một bức vẽ, một góc nhà gọn gàng,\nhay một điều thú vị bạn chưa từng biết."
                    : "Thêm hoạt động mới hoặc bật lại một nhánh\ntrong Thư viện để bắt đầu."}
                </p>
                {available ? (
                  <span className="waiting-label">
                    Nhấn “Random ngay!” để khám phá <Sparkles size={14} />
                  </span>
                ) : (
                  <button className="button secondary" onClick={goLibrary}>
                    <BookOpen size={16} /> Mở Thư viện
                  </button>
                )}
              </div>
            )}
          </section>
          {notice && (
            <p role="status" className="inline-notice">
              {notice}
            </p>
          )}
        </div>
        <aside className="random-sidebar">
          <section className="little-note">
            <div className="note-icon">
              <Sprout size={24} />
            </div>
            <h3>Không cần làm điều lớn lao.</h3>
            <p>
              Mười phút cho một điều bạn thích cũng đủ để hôm nay khác hôm qua
              một chút.
            </p>
            <span className="note-decoration" aria-hidden="true">
              ✳
            </span>
          </section>
          <section className="panel day-stats">
            <h3>Những bước nhỏ của bạn</h3>
            <div className="stats-pair">
              <div>
                <strong>{doc.history.length}</strong>
                <span>Lượt khám phá</span>
              </div>
              <div>
                <strong>{doc.history.filter((h) => h.completed).length}</strong>
                <span>Đã hoàn thành</span>
              </div>
            </div>
            <div className="stats-footer">
              <span className="mini-icon">
                <Leaf size={15} />
              </span>{" "}
              Mỗi lần bắt đầu đều đáng ghi nhận.
            </div>
          </section>
          <section className="library-teaser">
            <div className="mini-icon">
              <BookOpen size={19} />
            </div>
            <h3>Thư viện cộng đồng</h3>
            <p>
              Thêm điều bạn muốn thử, những chủ đề bạn tò mò. Mọi ý tưởng đều có
              chỗ ở đây.
            </p>
            <button className="text-button" onClick={goLibrary}>
              Khám phá Thư viện <BookOpen size={15} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
