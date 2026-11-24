import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const AUTH_KEY = "hom-nay-lam-gi.auth.v1";
const authSession = () => ({
  access_token: "access",
  refresh_token: "refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "A", email: "a@example.com" },
});
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Supabase REST Auth", () => {
  it("khách dùng public API key và không gửi publishable key như JWT", async () => {
    const fetch = vi.fn(async () => response([]));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../src/services/supabase");
    await api("/rest/v1/activity_nodes");
    const headers = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(headers[1].headers).toMatchObject({ apikey: "sb_publishable_test" });
    expect(
      (headers[1].headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });
  it("đăng nhập lưu phiên, không lưu mật khẩu; logout xóa phiên", async () => {
    const fetch = vi.fn(async (path: string) =>
      path.endsWith("/logout") ? response(null) : response(authSession()),
    );
    vi.stubGlobal("fetch", fetch);
    const auth = await import("../src/services/supabase");
    await auth.signIn("a@example.com", "private-password");
    expect(auth.getSession()?.user.id).toBe("A");
    expect(localStorage.getItem(AUTH_KEY)).not.toContain("private-password");
    await auth.signOut();
    expect(auth.getSession()).toBeNull();
    expect(localStorage.getItem(AUTH_KEY)).toBeNull();
  });
  it("đăng ký cần xác nhận email không tạo phiên giả", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ id: "A" })),
    );
    const auth = await import("../src/services/supabase");
    expect(await auth.signUp("a@example.com", "password123", "A")).toBe(false);
    expect(auth.getSession()).toBeNull();
  });
  it("refresh phiên hết hạn trước khi gửi database request; hai request dùng chung một refresh", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ ...authSession(), expires_at: 0 }),
    );
    let refreshes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init: RequestInit) => {
        if (path.includes("grant_type=refresh_token")) {
          refreshes++;
          return response({ ...authSession(), access_token: "new-access" });
        }
        expect((init.headers as Record<string, string>).Authorization).toBe(
          "Bearer new-access",
        );
        return response([]);
      }),
    );
    const auth = await import("../src/services/supabase");
    await Promise.all([
      auth.api("/rest/v1/activity_nodes"),
      auth.api("/rest/v1/resources"),
    ]);
    expect(refreshes).toBe(1);
  });
  it("lỗi mạng khi refresh giữ phiên để thử lại", async () => {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ ...authSession(), expires_at: 0 }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network failed");
      }),
    );
    const auth = await import("../src/services/supabase");
    await expect(auth.api("/rest/v1/activity_nodes")).rejects.toThrow();
    expect(auth.getSession()).not.toBeNull();
  });
  it("session hỏng không làm crash app", async () => {
    localStorage.setItem(AUTH_KEY, '{"user":null}');
    const auth = await import("../src/services/supabase");
    expect(auth.getSession()).toBeNull();
  });
  it("xác nhận email xác minh user và xóa token khỏi URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/#access_token=confirmed&refresh_token=refresh&expires_in=3600&type=signup",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ id: "A", email: "a@example.com" })),
    );
    const auth = await import("../src/services/supabase");
    await auth.completeEmailConfirmation();
    expect(location.hash).toBe("#random");
    expect(auth.getSession()?.user.id).toBe("A");
  });
});

it("đọc công khai vẫn được khi phiên đăng nhập đã hết hạn, không cần refresh", async () => {
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({ ...authSession(), expires_at: 0 }),
  );
  const fetch = vi.fn(async () => response([]));
  vi.stubGlobal("fetch", fetch);
  const auth = await import("../src/services/supabase");
  await auth.publicApi("/rest/v1/rpc/get_public_library", {
    method: "POST",
    body: "{}",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch.mock.calls[0] as unknown as [string])[0]).not.toContain(
    "grant_type=refresh_token",
  );
});
