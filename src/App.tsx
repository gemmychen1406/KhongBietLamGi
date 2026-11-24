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
import { LibraryStatus } from "./components/LibraryStatus";
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
        nodes: createSeedDocument().nodes,
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
        nodes: createSeedDocument().nodes,
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
    systemSeedKey: undefined,
    contributorName: undefined,
    children: asNewContributions(n.children),
    resources: n.resources.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      createdBy: undefined,
      systemSeedKey: undefined,
      contributorName: undefined,
    })),
    variants: n.variants.map((v) => ({
      ...v,
      id: crypto.randomUUID(),
      createdBy: undefined,
      systemSeedKey: undefined,
      contributorName: undefined,
      resources: v.resources.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        createdBy: undefined,
        systemSeedKey: undefined,
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
  const [source, setSource] = useState<"sample" | "community">("sample");
  const sourceRef = useRef<"sample" | "community">("sample");
  const requestVersion = useRef(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const saving = useRef(false);
  const closeBackup = useCallback(() => setBackup(false), []);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    setReady(false);
    try {
      const nodes = await loadLibrary();
      if (version !== requestVersion.current) return;
      const nextSource = nodes.length ? "community" : "sample";
      sourceRef.current = nextSource;
      setSource(nextSource);
      setDoc((d) => ({
        ...d,
        nodes: nodes.length ? nodes : createSeedDocument().nodes,
      }));
      setReady(true);
    } catch (e) {
      if (version !== requestVersion.current) return;
      setError(communityError(e));
      // Preserve previously downloaded community content on a temporary outage.
      if (sourceRef.current !== "community")
        setDoc((d) => ({ ...d, nodes: createSeedDocument().nodes }));
      setReady(false);
    } finally {
      if (version === requestVersion.current) setLoading(false);
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
    if (source !== "community")
      throw new Error(
        "Dữ liệu mẫu cục bộ chỉ đọc, chưa được đồng bộ lên cộng đồng.",
      );
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
      value={{
        userId: session?.user.id ?? null,
        admin,
        community: true,
        readOnly: source === "sample" || !ready || loading,
        librarySource: source,
      }}
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
          <div className="workspace-bar">
            <LibraryStatus
              source={source}
              configured={configured}
              loading={loading}
              ready={ready}
              error={error}
              onRefresh={() => void refresh()}
            />
            <AuthPanel session={session} admin={admin} />
          </div>
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
              key={source}
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
        </main>
        <footer className="site-footer">
          <div>
            <span className="footer-brand">✦ Một chút cảm hứng, mỗi ngày.</span>
            <span className="local-note">
              {source === "community"
                ? "Thư viện: Supabase"
                : "Thư viện: Mẫu cục bộ, chưa đồng bộ"}{" "}
              · Lịch sử: thiết bị này
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
            librarySource={source}
            canImport={
              Boolean(session) && ready && source === "community" && !loading
            }
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
