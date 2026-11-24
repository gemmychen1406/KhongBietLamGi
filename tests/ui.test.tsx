import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ActivityNode, AppDocument } from "../src/types";
const state = vi.hoisted(() => ({
  user: null as null | {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: { id: string; email: string };
  },
  nodes: [] as ActivityNode[],
  fail: false,
  loadFail: false,
  legacySchema: false,
}));
vi.mock("../src/services/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/supabase")>()),
  configured: true,
  getSession: () => state.user,
  onSession: () => () => {},
  api: vi.fn(async () => false),
  completeEmailConfirmation: vi.fn(async () => {}),
}));
vi.mock("../src/services/community", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/community")>()),
  loadLibrary: vi.fn(async () => {
    if (state.loadFail) throw new TypeError("Network failed");
    const nodes = structuredClone(state.nodes);
    if (state.legacySchema) {
      const strip = (ns: ActivityNode[]) =>
        ns.forEach((n) => {
          delete n.revision;
          n.resources.forEach((r) => delete r.revision);
          n.variants.forEach((v) => {
            delete v.revision;
            v.resources.forEach((r) => delete r.revision);
          });
          strip(n.children);
        });
      strip(nodes);
    } else {
      const stamp = (ns: ActivityNode[]) =>
        ns.forEach((n) => {
          n.revision ??= 0;
          n.resources.forEach((r) => {
            r.revision ??= 0;
          });
          n.variants.forEach((v) => {
            v.revision ??= 0;
            v.resources.forEach((r) => {
              r.revision ??= 0;
            });
          });
          stamp(n.children);
        });
      stamp(nodes);
    }
    return nodes;
  }),
  saveLibrary: vi.fn(async (_before, after: ActivityNode[]) => {
    if (state.fail) throw { code: "42501" };
    state.nodes = structuredClone(after);
  }),
}));
import App, { PERSONAL_KEY } from "../src/App";
import { loadLibrary, saveLibrary } from "../src/services/community";
import { STORAGE_KEY, parseDocument } from "../src/services/storage";
const fixture = (): ActivityNode => ({
  id: "task",
  revision: 0,
  title: "Hoạt động A",
  description: "Gợi ý A",
  kind: "activity",
  enabled: true,
  children: [],
  variants: [],
  resources: [],
  createdBy: "A",
  contributorName: "Người A",
});
beforeEach(() => {
  localStorage.clear();
  state.user = null;
  state.nodes = [fixture()];
  state.fail = false;
  state.loadFail = false;
  state.legacySchema = false;
  window.history.replaceState(null, "", "/#random");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(cleanup);
async function mounted(page = "random") {
  window.history.replaceState(null, "", `/#${page}`);
  const app = render(<App />);
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Tải lại thư viện" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  return app;
}
function member() {
  state.user = {
    access_token: "test",
    refresh_token: "test",
    expires_at: 9999999999,
    user: { id: "B", email: "b@example.com" },
  };
}
describe("UI cộng đồng", () => {
  it("khách random và reload giữ snapshot lịch sử; cây không lưu localStorage", async () => {
    const app = await mounted();
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Đánh dấu hoàn thành" }),
    );
    await waitFor(() =>
      expect(
        parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].completed,
      ).toBe(true),
    );
    expect(parseDocument(localStorage.getItem(PERSONAL_KEY)!).nodes).toEqual(
      [],
    );
    app.unmount();
    await mounted("history");
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
  });
  it("khách đọc chi tiết và tài nguyên nhưng không có nút ghi", async () => {
    await mounted("library");
    expect(screen.queryByRole("button", { name: "Thêm hoạt động" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sửa Hoạt động A" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết / Thêm tài nguyên" }),
    );
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Thêm tài nguyên" }),
    ).toBeNull();
    expect(
      (screen.getByLabelText("Tên hoạt động *") as HTMLInputElement).closest(
        "fieldset",
      )!.disabled,
    ).toBe(true);
  });
  it("B thêm tài nguyên vào hoạt động A, giữ nguyên tác giả A, reload thấy dữ liệu chung", async () => {
    member();
    const app = await mounted("library");
    expect(
      screen.queryByRole("button", { name: "Xóa Hoạt động A" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết / Thêm tài nguyên" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm tài nguyên" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Tài nguyên B" },
    });
    fireEvent.change(screen.getByLabelText("Nội dung *"), {
      target: { value: "Gợi ý B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(state.nodes[0].resources[0]?.title).toBe("Tài nguyên B"),
    );
    expect(state.nodes[0].createdBy).toBe("A");
    app.unmount();
    state.user = null;
    await mounted("library");
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết / Thêm tài nguyên" }),
    );
    expect(
      (screen.getByLabelText("Nội dung *") as HTMLTextAreaElement).value,
    ).toBe("Gợi ý B");
  });
  it("lỗi quyền giữ form mở và không báo lưu thành công", async () => {
    member();
    state.fail = true;
    await mounted("library");
    fireEvent.click(screen.getByRole("button", { name: "Thêm hoạt động" }));
    fireEvent.change(screen.getByLabelText("Tên hoạt động *"), {
      target: { value: "Mới" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((x) => x.textContent?.includes("không có quyền")),
      ).toBe(true),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(state.nodes).toHaveLength(1);
  });
  it("chặn xóa nhánh có đóng góp phụ thuộc trước khi gửi request", async () => {
    member();
    state.nodes = [
      { ...fixture(), createdBy: "B", kind: "group", children: [fixture()] },
    ];
    await mounted("library");
    const before = vi.mocked(saveLibrary).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Xóa Hoạt động A" }));
    expect(screen.getByRole("alert").textContent).toContain("còn phụ thuộc");
    expect(vi.mocked(saveLibrary).mock.calls.length).toBe(before);
  });
  it("URL nguy hiểm không gửi lên dịch vụ", async () => {
    member();
    await mounted("library");
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết / Thêm tài nguyên" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm tài nguyên" }));
    fireEvent.change(screen.getByLabelText("Loại"), {
      target: { value: "link" },
    });
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Xấu" },
    });
    fireEvent.change(screen.getByLabelText("URL http(s)"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(state.nodes[0].resources).toEqual([]);
  });
  it("đóng góp của tôi gồm tài nguyên trên hoạt động người khác", async () => {
    member();
    state.nodes[0].resources = [
      {
        id: "r",
        title: "Tài nguyên của B",
        type: "text",
        content: "B",
        createdBy: "B",
      },
    ];
    await mounted("mine");
    fireEvent.click(screen.getByRole("tab", { name: /Chủ đề và tài nguyên/ }));
    expect(
      screen.getByRole("heading", { name: "Tài nguyên của B" }),
    ).toBeTruthy();
  });
  it("giữ nguyên JSON cũ khi nâng cấp và chỉ lấy lịch sử, thư viện lấy từ server", async () => {
    const old: AppDocument = {
      schemaVersion: 1,
      nodes: [{ ...fixture(), title: "Dữ liệu cũ" }],
      history: [],
      settings: { autoSaveHistory: true },
    };
    const raw = JSON.stringify(old);
    localStorage.setItem(STORAGE_KEY, raw);
    await mounted();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
  });
});

describe("Backup cộng đồng", () => {
  it("preview file sai không ghi; nhập hợp lệ cần xác nhận và không ghi đè cộng đồng", async () => {
    member();
    await mounted();
    fireEvent.click(screen.getByRole("button", { name: "Sao lưu dữ liệu" }));
    function file(content: string) {
      const f = new File([], "backup.json", { type: "application/json" });
      Object.defineProperty(f, "text", { value: async () => content });
      return f;
    }
    fireEvent.change(screen.getByLabelText("Chọn file JSON"), {
      target: { files: [file("{broken")] },
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(state.nodes).toHaveLength(1);
    const backup: AppDocument = {
      schemaVersion: 1,
      nodes: [{ ...fixture(), createdBy: "forged-owner", title: "Đã nhập" }],
      history: [],
      settings: { autoSaveHistory: true },
    };
    fireEvent.change(screen.getByLabelText("Chọn file JSON"), {
      target: { files: [file(JSON.stringify(backup))] },
    });
    const confirm = await screen.findByRole("button", {
      name: "Xác nhận khôi phục",
    });
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(confirm);
    expect(state.nodes).toHaveLength(1);
    fireEvent.click(confirm);
    await waitFor(() => expect(state.nodes).toHaveLength(2));
    expect(state.nodes[0].title).toBe("Hoạt động A");
    expect(state.nodes[1].title).toBe("Đã nhập");
    expect(state.nodes[1].id).not.toBe("task");
    expect(state.nodes[1].createdBy).toBeUndefined();
  });
  it("member sửa được tài nguyên/variant người khác nhưng không có nút xóa", async () => {
    member();
    state.nodes[0].variants = [
      {
        id: "va",
        title: "Variant A",
        createdBy: "A",
        contributorName: "Người A",
        resources: [
          {
            id: "ra",
            title: "Tài nguyên A",
            type: "text",
            content: "Giữ nguyên",
            createdBy: "A",
          },
        ],
      },
    ];
    await mounted("library");
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết / Thêm tài nguyên" }),
    );
    expect(
      screen.queryByRole("button", { name: "Xóa biến thể Variant A" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa tài nguyên" })).toBeNull();
    expect(
      (screen.getByLabelText("Tên biến thể *") as HTMLInputElement).closest(
        "fieldset",
      )?.disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Thêm biến thể" }));
    const names = screen.getAllByLabelText("Tên biến thể *");
    fireEvent.change(names[1], { target: { value: "Variant B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(state.nodes[0].variants).toHaveLength(2));
    expect(state.nodes[0].variants[0].createdBy).toBe("A");
  });
});

describe("Random cho khách và mẫu chỉ đọc", () => {
  it("Supabase rỗng: đủ ba nhóm, random và lưu lịch sử nguồn mẫu rõ ràng", async () => {
    state.nodes = [];
    await mounted();
    for (const title of ["Nội trợ", "Nghệ thuật", "Kiến thức"])
      expect(screen.getByRole("button", { name: title })).toBeTruthy();
    expect(screen.getByText("Chỉ đọc · Chưa đồng bộ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nghệ thuật" }));
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    await waitFor(() =>
      expect(
        parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
          .source,
      ).toBe("sample"),
    );
    expect(
      parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
        .path[0].title,
    ).toBe("Nghệ thuật");
  });
  it("đăng nhập vẫn không ghi được mẫu cục bộ hoặc import vào chế độ mẫu", async () => {
    member();
    state.nodes = [];
    await mounted("library");
    expect(screen.queryByRole("button", { name: "Thêm hoạt động" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thêm nhóm mới" })).toBeNull();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Chi tiết nhóm" })[0],
    );
    expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Sao lưu dữ liệu" }));
    expect(
      (screen.getByLabelText("Chọn file JSON") as HTMLInputElement).disabled,
    ).toBe(true);
  });
  it("lỗi mạng khi mở trang: khách vẫn chọn nhóm và random mẫu", async () => {
    state.loadFail = true;
    await mounted();
    expect(screen.getByRole("alert").textContent).toContain(
      "Chưa kết nối được Supabase",
    );
    fireEvent.click(screen.getByRole("button", { name: "Kiến thức" }));
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    await waitFor(() =>
      expect(
        parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
          .path[0].title,
      ).toBe("Kiến thức"),
    );
  });
  it("cộng đồng có dữ liệu sau tải lại: thay mẫu, bỏ nhãn mẫu và cho Member đóng góp", async () => {
    member();
    state.nodes = [];
    await mounted();
    state.nodes = [fixture()];
    fireEvent.click(screen.getByRole("button", { name: "Tải lại thư viện" }));
    await waitFor(() => expect(screen.getByText("Đã cập nhật")).toBeTruthy());
    expect(
      screen.queryByText("Dữ liệu mẫu cục bộ · Chỉ đọc · Chưa đồng bộ", {
        selector: "strong",
      }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
    await waitFor(() =>
      expect(
        parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
          .source,
      ).toBe("community"),
    );
  });
  it("lỗi tải lại không thay thư viện cộng đồng đã tải bằng mẫu khác", async () => {
    await mounted();
    state.loadFail = true;
    fireEvent.click(screen.getByRole("button", { name: "Tải lại thư viện" }));
    await waitFor(() =>
      expect(screen.getByText("Bản đã tải · Chỉ đọc")).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Nội trợ" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
  });
  it("trong lúc chờ Supabase: random mẫu được, lịch sử được giữ khi chuyển nguồn", async () => {
    let resolve!: (nodes: ActivityNode[]) => void;
    vi.mocked(loadLibrary).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Nội trợ" }));
    fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
    expect(
      parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
        .source,
    ).toBe("sample");
    resolve([fixture()]);
    await waitFor(() => expect(screen.getByText("Đã cập nhật")).toBeTruthy());
    // The result card is remounted when source changes; the sample snapshot stays in personal history.
    expect(
      parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0].result
        .source,
    ).toBe("sample");
    expect(
      screen.queryByText("Mẫu cục bộ · Chưa đồng bộ", { selector: "small" }),
    ).toBeNull();
  });
});

describe("Quyền sửa chung và điều hướng đóng góp", () => {
  it("Member B sửa tên của A nhưng không có nút xóa A", async () => {
    member();
    await mounted("library");
    expect(
      screen.queryByRole("button", { name: "Xóa Hoạt động A" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sửa Hoạt động A" }));
    expect(
      (screen.getByLabelText("Tên hoạt động *") as HTMLInputElement).closest(
        "fieldset",
      )?.disabled,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Tên hoạt động *"), {
      target: { value: "A được B sửa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(state.nodes[0].title).toBe("A được B sửa"));
    expect(state.nodes[0].createdBy).toBe("A");
  });
  it("chưa chạy 003 thì UI giữ chế độ chỉ đọc, hướng dẫn cập nhật thay vì bật nút ghi", async () => {
    member();
    state.legacySchema = true;
    await mounted("library");
    expect(screen.getByText("Chỉ đọc · Cần cập nhật quyền")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Sửa Hoạt động A" }),
    ).toBeNull();
    fireEvent.click(screen.getByLabelText("Thông tin nguồn dữ liệu"));
    expect(
      screen.getByText(/Chủ website cần chạy 003_collaborative_editing.sql/),
    ).toBeTruthy();
  });
  it("Chỉnh sửa trong đóng góp mở đúng editor của node trong Thư viện", async () => {
    member();
    state.nodes[0].createdBy = "B";
    await mounted("mine");
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    expect(await screen.findByLabelText("Tên hoạt động *")).toBeTruthy();
    expect(
      (screen.getByLabelText("Tên hoạt động *") as HTMLInputElement).value,
    ).toBe("Hoạt động A");
  });
});
