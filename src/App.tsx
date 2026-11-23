import { useState, useEffect, useCallback } from "react";
import {
  Dice5,
  Shuffle,
  BookOpen,
  History,
  Download,
  HardDrive,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { createSeedDocument } from "./data/seed";
import {
  readDocument,
  saveDocument,
  readableError,
  STORAGE_KEY,
  downloadJson,
} from "./services/storage";
import type { AppDocument } from "./types";
import { RandomPage } from "./pages/RandomPage";
import { LibraryPage } from "./pages/LibraryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { BackupDialog } from "./components/BackupDialog";
type Page = "random" | "library" | "history";
function readPage(): Page {
  const value = location.hash.slice(1);
  return value === "library" || value === "history" ? value : "random";
}
function initialState() {
  try {
    return {
      doc: readDocument() ?? createSeedDocument(),
      error: "",
      blocked: false,
    };
  } catch (error) {
    return {
      doc: createSeedDocument(),
      error: `Không đọc được dữ liệu đã lưu: ${readableError(error)} Bản gốc chưa bị ghi đè. Đang hiển thị dữ liệu mẫu tạm thời; hãy tải bản gốc, rồi nhập bản sao hoặc xác nhận khôi phục mẫu.`,
      blocked: true,
    };
  }
}
export default function App() {
  const [initial] = useState(initialState);
  const [doc, setDoc] = useState<AppDocument>(initial.doc);
  const [storageError, setStorageError] = useState(initial.error);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [page, setPage] = useState<Page>(readPage);
  const [backup, setBackup] = useState(false);
  const [toast, setToast] = useState("");
  const closeBackup = useCallback(() => setBackup(false), []);
  useEffect(() => {
    const update = () => setPage(readPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (blocked) return;
    try {
      saveDocument(doc);
      setStorageError("");
    } catch {
      setStorageError(
        "Chưa lưu được thay đổi vào trình duyệt (có thể bộ nhớ đầy hoặc bị chặn). Dữ liệu vẫn ở phiên này; hãy xuất JSON ngay để tránh mất khi tải lại.",
      );
    }
  }, [doc, blocked]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  function navigate(value: Page) {
    location.hash = value;
    setPage(value);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function restore(next: AppDocument) {
    setDoc(next);
    setBlocked(false);
    setToast("Đã thay thế dữ liệu.");
  }
  function reset() {
    if (
      window.confirm(
        "Khôi phục toàn bộ thư viện mẫu và xóa toàn bộ lịch sử? Hãy xuất JSON trước nếu muốn giữ dữ liệu hiện tại.",
      )
    )
      restore(createSeedDocument());
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#random"
            aria-label="Hôm nay làm gì nhỉ? — Trang Random"
          >
            <span className="brand-mark">
              <Dice5 size={26} strokeWidth={1.8} />
            </span>
            <span>
              Hôm nay
              <br />
              <strong>làm gì nhỉ?</strong>
            </span>
          </a>
          <nav aria-label="Điều hướng chính">
            {(
              [
                { value: "random", label: "Random", icon: Shuffle },
                { value: "library", label: "Thư viện", icon: BookOpen },
                { value: "history", label: "Lịch sử", icon: History },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <a
                href={`#${value}`}
                key={value}
                className={page === value ? "active" : ""}
                aria-current={page === value ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
              </a>
            ))}
          </nav>
          <button
            className="button backup-button secondary"
            onClick={() => setBackup(true)}
          >
            <Download size={17} />
            <span>Sao lưu dữ liệu</span>
          </button>
        </div>
      </header>
      <main className="main-content">
        {storageError && (
          <div role="alert" className="alert error storage-error">
            <AlertTriangle size={21} />
            <div>
              <p>{storageError}</p>
              <div className="error-actions">
                <button
                  className="button small secondary"
                  onClick={() => setBackup(true)}
                >
                  Xuất / nhập JSON
                </button>
                {blocked ? (
                  <>
                    <button
                      className="button small secondary"
                      onClick={() => {
                        try {
                          const raw = localStorage.getItem(STORAGE_KEY);
                          if (raw !== null)
                            downloadJson(raw, "du-lieu-goc-can-khoi-phuc.json");
                          else setToast("Không tìm thấy bản gốc trong bộ nhớ.");
                        } catch (e) {
                          setToast(readableError(e));
                        }
                      }}
                    >
                      Tải dữ liệu gốc
                    </button>
                    <button className="button small secondary" onClick={reset}>
                      Khôi phục mẫu
                    </button>
                  </>
                ) : (
                  <button
                    className="button small secondary"
                    onClick={() => setDoc({ ...doc })}
                  >
                    Thử lưu lại
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {page === "random" && (
          <RandomPage
            doc={doc}
            onChange={setDoc}
            goLibrary={() => navigate("library")}
          />
        )}
        {page === "library" && (
          <LibraryPage doc={doc} onChange={setDoc} onReset={reset} />
        )}
        {page === "history" && (
          <HistoryPage
            doc={doc}
            onChange={setDoc}
            goRandom={() => navigate("random")}
          />
        )}
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">
            <span>✦</span> Một chút cảm hứng, mỗi ngày.
          </span>
          <span className="local-note">
            <HardDrive size={14} /> Lưu trên thiết bị này · Không tự đồng bộ
          </span>
        </div>
        <button className="text-button" onClick={() => setBackup(true)}>
          <ShieldCheck size={15} /> Đừng quên sao lưu nhé
        </button>
      </footer>
      {backup && (
        <BackupDialog doc={doc} onImport={restore} onClose={closeBackup} />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
