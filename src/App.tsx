import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dice5,
  Shuffle,
  BookOpen,
  History,
  Download,
  UserRound,
} from "lucide-react";
import { createSeedDocument } from "./data/seed";
import {
  readDocument,
  parseDocument,
  STORAGE_KEY,
  downloadJson,
  readableError,
} from "./services/storage";
import {
  completeEmailConfirmation,
  configured,
  getSession,
  onSession,
  api,
  communityError,
} from "./services/supabase";
import { loadLibrary, saveLibrary } from "./services/community";
import { PermissionContext } from "./services/permissions";
import type { ActivityNode, AppDocument } from "./types";
import { RandomPage } from "./pages/RandomPage";
import { LibraryPage } from "./pages/LibraryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { BackupDialog } from "./components/BackupDialog";
import { AdminPanel } from "./components/AdminPanel";
import { AuthPanel } from "./components/AuthPanel";
import { MyContributions } from "./pages/MyContributions";
export const PERSONAL_KEY = "hom-nay-lam-gi.personal.v1";
type Page = "random" | "library" | "history" | "mine";
function readPage(): Page {
  const p = location.hash.slice(1);
  return p === "library" || p === "history" || p === "mine" ? p : "random";
}
function initialState(): { doc: AppDocument; error: string; blocked: boolean } {
  try {
    const raw = localStorage.getItem(PERSONAL_KEY);
    const old = raw ? parseDocument(raw) : readDocument();
    return {
      doc: {
        schemaVersion: 1,
        nodes: [],
        history: old?.history ?? [],
        settings: { autoSaveHistory: true },
      },
      error: "",
      blocked: false,
    };
  } catch (e) {
    return {
      doc: {
        schemaVersion: 1,
        nodes: [],
        history: [],
        settings: { autoSaveHistory: true },
      },
      error: `Không đọc được lịch sử: ${readableError(e)} Bản gốc chưa bị ghi đè.`,
      blocked: true,
    };
  }
}
// Import is additive. IDs and attribution from a backup never confer ownership.
export function asNewContributions(nodes: ActivityNode[]): ActivityNode[] {
  return nodes.map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    createdBy: undefined,
    contributorName: undefined,
    children: asNewContributions(n.children),
    resources: n.resources.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      createdBy: undefined,
      contributorName: undefined,
    })),
    variants: n.variants.map((v) => ({
      ...v,
      id: crypto.randomUUID(),
      createdBy: undefined,
      contributorName: undefined,
      resources: v.resources.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        createdBy: undefined,
        contributorName: undefined,
      })),
    })),
  }));
}
export default function App() {
  const [initial] = useState(initialState);
  const [doc, setDoc] = useState(initial.doc);
  const [storageError, setStorageError] = useState(initial.error);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [session, setSession] = useState(getSession);
  const [admin, setAdmin] = useState(false);
  const [page, setPage] = useState<Page>(readPage);
  const [backup, setBackup] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const saving = useRef(false);
  const closeBackup = useCallback(() => setBackup(false), []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nodes = await loadLibrary();
      setDoc((d) => ({ ...d, nodes }));
      setReady(true);
    } catch (e) {
      setError(communityError(e));
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => onSession(setSession), []);
  useEffect(() => {
    if (configured)
      void completeEmailConfirmation().catch((e) =>
        setError(communityError(e)),
      );
  }, []);
  useEffect(() => {
    if (configured) void refresh();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setAdmin(false);
    if (session)
      void api<boolean>("/rest/v1/rpc/is_admin", { method: "POST", body: "{}" })
        .then((value) => {
          if (active) setAdmin(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    const fn = () => setPage(readPage());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (blocked) return;
    try {
      localStorage.setItem(PERSONAL_KEY, JSON.stringify({ ...doc, nodes: [] }));
      setStorageError("");
    } catch {
      setStorageError(
        "Chưa lưu được lịch sử trên thiết bị. Hãy xuất JSON trước khi đóng trang.",
      );
    }
  }, [doc.history, blocked]); // Library is never persisted as the shared source.
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function changeLibrary(next: AppDocument, baseline: AppDocument = doc) {
    if (!session) throw { code: "42501" };
    if (!ready || loading || saving.current)
      throw new Error("Hãy chờ thư viện tải xong trước khi lưu.");
    saving.current = true;
    try {
      await saveLibrary(baseline.nodes, next.nodes, session.user.id);
      setToast("Đã lưu đóng góp lên Supabase.");
      await refresh();
    } finally {
      saving.current = false;
    }
  }
  async function importBackup(next: AppDocument) {
    await changeLibrary({
      ...doc,
      nodes: [...doc.nodes, ...asNewContributions(next.nodes)],
    });
    setDoc((d) => ({ ...d, history: next.history }));
    setBlocked(false);
  }
  function navigate(p: Page) {
    location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <PermissionContext.Provider
      value={{ userId: session?.user.id ?? null, admin, community: true }}
    >
      <div className="app-shell">
        <header className="site-header">
          <div className="header-inner">
            <a className="brand" href="#random">
              <span className="brand-mark">
                <Dice5 size={26} />
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
                  { value: "mine", label: "Đóng góp của tôi", icon: UserRound },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <a
                  key={value}
                  href={`#${value}`}
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
          <AuthPanel session={session} admin={admin} />
          {!configured && (
            <p className="alert error" role="alert">
              Chưa cấu hình Supabase. Thêm biến môi trường theo docs/SUPABASE.md
              để tải thư viện cộng đồng. Dữ liệu cũ trên trình duyệt được giữ
              nguyên.
            </p>
          )}
          {configured && (
            <div className="community-toolbar">
              <span>
                {loading
                  ? "Đang tải thư viện…"
                  : "Thư viện cộng đồng · Dữ liệu công khai"}
              </span>
              <button
                className="button small secondary"
                disabled={loading}
                onClick={() => void refresh()}
              >
                Tải lại thư viện
              </button>
            </div>
          )}
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          {storageError && (
            <div className="alert error" role="alert">
              <p>{storageError}</p>
              <button
                className="button small secondary"
                onClick={() => {
                  try {
                    const raw =
                      localStorage.getItem(PERSONAL_KEY) ??
                      localStorage.getItem(STORAGE_KEY);
                    if (raw) downloadJson(raw, "du-lieu-can-khoi-phuc.json");
                  } catch (e) {
                    setToast(readableError(e));
                  }
                }}
              >
                Tải dữ liệu cần khôi phục
              </button>
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
            <LibraryPage
              doc={doc}
              onChange={changeLibrary}
              onReset={() => {}}
            />
          )}
          {page === "history" && (
            <HistoryPage
              doc={doc}
              onChange={setDoc}
              goRandom={() => navigate("random")}
            />
          )}
          {page === "mine" && (
            <MyContributions
              nodes={doc.nodes}
              onOpenLibrary={() => navigate("library")}
            />
          )}
          {admin && page === "mine" && (
            <AdminPanel
              onRoleChange={() => {
                void api<boolean>("/rest/v1/rpc/is_admin", {
                  method: "POST",
                  body: "{}",
                })
                  .then(setAdmin)
                  .catch(() => setAdmin(false));
              }}
            />
          )}
          {admin && page === "library" && (
            <button
              className="button secondary"
              disabled={!ready || loading}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Thêm bản sao thư viện mẫu vào cộng đồng? Nội dung hiện có được giữ nguyên. Chỉ chạy một lần để tránh trùng nội dung.",
                  )
                )
                  return;
                try {
                  await changeLibrary({
                    ...doc,
                    nodes: [
                      ...doc.nodes,
                      ...asNewContributions(createSeedDocument().nodes),
                    ],
                  });
                } catch (e) {
                  setError(communityError(e));
                }
              }}
            >
              Thêm dữ liệu mẫu (Admin)
            </button>
          )}
        </main>
        <footer className="site-footer">
          <div>
            <span className="footer-brand">✦ Một chút cảm hứng, mỗi ngày.</span>
            <span className="local-note">
              Thư viện: Supabase · Lịch sử: thiết bị này
            </span>
          </div>
          <button
            className="text-button"
            onClick={() => {
              try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) downloadJson(raw, "du-lieu-cu.json");
                else
                  setToast("Không có dữ liệu phiên bản cũ trên thiết bị này.");
              } catch (e) {
                setToast(readableError(e));
              }
            }}
          >
            Tải bản gốc trước nâng cấp
          </button>
        </footer>
        {backup && (
          <BackupDialog
            doc={doc}
            community
            canImport={Boolean(session) && ready}
            onImport={importBackup}
            onClose={closeBackup}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </PermissionContext.Provider>
  );
}
