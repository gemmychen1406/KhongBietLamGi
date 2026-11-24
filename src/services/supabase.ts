// Small REST adapter: public key only. All authorization is enforced by database RLS.
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
}
const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
const SESSION_KEY = "hom-nay-lam-gi.auth.v1";
let session: Session | null = null;
let refreshing: Promise<void> | null = null;
const listeners = new Set<(s: Session | null) => void>();
function parseSession(raw: string | null): Session | null {
  const value: unknown = JSON.parse(raw ?? "null");
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<Session>;
  return typeof s.access_token === "string" &&
    typeof s.refresh_token === "string" &&
    typeof s.expires_at === "number" &&
    typeof s.user?.id === "string"
    ? (s as Session)
    : null;
}
try {
  session = parseSession(localStorage.getItem(SESSION_KEY));
} catch {
  /* Login remains available when storage is unavailable. */
}
function updateSession(value: Session | null) {
  session = value;
  try {
    if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Session works until this page closes. */
  }
  listeners.forEach((fn) => fn(value));
}
window.addEventListener("storage", (e) => {
  if (e.key === SESSION_KEY) {
    try {
      session = parseSession(e.newValue);
    } catch {
      session = null;
    }
    listeners.forEach((fn) => fn(session));
  }
});
export const getSession = () => session;
export function onSession(fn: (s: Session | null) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  if (!configured)
    throw new Error("Chưa cấu hình Supabase. Xem docs/SUPABASE.md.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}${path}`, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        apikey: key!,
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : key?.startsWith("eyJ")
            ? { Authorization: `Bearer ${key}` }
            : {}),
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw body ?? { message: `Dịch vụ trả về lỗi ${response.status}` };
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}
async function acceptAuth(path: string, body: object) {
  const data = await request<Session & { expires_in?: number }>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (data.access_token)
    updateSession({
      ...data,
      expires_at:
        data.expires_at ??
        Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    });
  return Boolean(data.access_token);
}
async function accessToken() {
  if (session && session.expires_at < Date.now() / 1000 + 60) {
    if (!refreshing) {
      const refresh = async () => {
        // Re-read under a cross-tab lock, so a rotated refresh token is not reused by another tab.
        try {
          const latest = parseSession(localStorage.getItem(SESSION_KEY));
          if (latest) session = latest;
        } catch {
          /* in-memory session */
        }
        if (session && session.expires_at < Date.now() / 1000 + 60) {
          await acceptAuth("/auth/v1/token?grant_type=refresh_token", {
            refresh_token: session.refresh_token,
          });
        }
      };
      refreshing = (async () => {
        if (navigator.locks)
          await navigator.locks.request(`random-activity-auth:${url}`, refresh);
        else await refresh();
      })()
        .catch((e) => {
          // Network outages should not discard a recoverable session.
          const code = (e as { code?: string }).code;
          if (
            code === "refresh_token_not_found" ||
            code === "refresh_token_already_used" ||
            code === "session_not_found"
          )
            updateSession(null);
          throw e;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    await refreshing;
  }
  return session?.access_token;
}
// Public library reads are independent of expired or broken login sessions.
export async function publicApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return request<T>(path, init);
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init, await accessToken());
}
export async function signIn(email: string, password: string) {
  return acceptAuth("/auth/v1/token?grant_type=password", { email, password });
}
export async function signUp(
  email: string,
  password: string,
  displayName: string,
) {
  return acceptAuth("/auth/v1/signup", {
    email,
    password,
    data: { display_name: displayName },
  });
}
export async function signOut() {
  await api("/auth/v1/logout", { method: "POST" });
  updateSession(null);
}
export function publicImageUrl(path: string) {
  return `${url}/storage/v1/object/public/activity-images/${path}`;
}
export function communityError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Kết nối Supabase quá lâu. Bạn vẫn có thể random mẫu và thử tải lại sau.";
  if (error instanceof TypeError)
    return "Chưa kết nối được Supabase. Hãy kiểm tra mạng và thử tải lại.";
  const e = (error ?? {}) as {
    code?: string;
    message?: string;
    msg?: string;
    error_description?: string;
  };
  if (e.code === "23503")
    return "Không thể xóa: còn nhánh con, biến thể hoặc tài nguyên. Hãy xử lý từng đóng góp phụ thuộc trước; bạn không thể xóa nội dung của người khác.";
  if (e.code === "42501")
    return "Bạn chưa đăng nhập hoặc không có quyền thực hiện thao tác này.";
  if (e.code === "40001")
    return "Nội dung đã thay đổi hoặc bạn không còn quyền. Hãy tải lại thư viện trước khi sửa tiếp.";
  if (e.code === "invalid_credentials") return "Email hoặc mật khẩu chưa đúng.";
  if (e.code === "email_not_confirmed")
    return "Hãy xác nhận email trước khi đăng nhập.";
  return (
    e.message ??
    e.msg ??
    e.error_description ??
    "Không kết nối được dịch vụ. Vui lòng thử lại."
  );
}

export async function completeEmailConfirmation() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("access_token") && !params.has("error_description")) return;
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#random`,
  );
  if (params.has("error_description"))
    throw new Error(params.get("error_description")!);
  const token = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (!token || !refresh)
    throw new Error("Liên kết xác nhận chưa hợp lệ. Hãy đăng nhập lại.");
  const user = await request<Session["user"]>("/auth/v1/user", {}, token);
  updateSession({
    access_token: token,
    refresh_token: refresh,
    expires_at:
      Math.floor(Date.now() / 1000) + Number(params.get("expires_in") ?? 3600),
    user,
  });
}
