import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
const storage = vi.hoisted(() => ({
  files: [] as import("../src/services/images").UploadedImage[],
  fail: false,
}));
vi.mock("../src/services/supabase", async (original) => ({
  ...(await original<typeof import("../src/services/supabase")>()),
  configured: true,
}));
vi.mock("../src/services/images", () => ({
  listUploadedImages: vi.fn(async () => {
    if (storage.fail) throw new Error("Không đọc được ảnh");
    return storage.files;
  }),
}));
vi.mock("../src/services/community", () => ({
  deleteImage: vi.fn(async () => {}),
}));
import { MyContributions } from "../src/pages/MyContributions";
import { PermissionContext } from "../src/services/permissions";
import { deleteImage } from "../src/services/community";
import type { ActivityNode } from "../src/types";
function leaf(id: string, createdBy: string): ActivityNode {
  return {
    id,
    title: id,
    kind: "activity",
    enabled: true,
    createdBy,
    children: [],
    variants: [],
    resources: [],
    revision: 0,
  };
}
function fixture() {
  const mine = leaf("Hoạt động A", "A");
  mine.createdAt = "2026-11-23T00:00:00Z";
  const other = leaf("Chỉ sửa hộ B", "B");
  other.updatedBy = "A";
  other.resources = [
    {
      id: "r",
      title: "Tài nguyên A",
      createdBy: "A",
      type: "text",
      content: "Nội dung tham khảo A",
    },
    {
      id: "r-b",
      title: "Tài nguyên B",
      createdBy: "B",
      type: "text",
      content: "B",
    },
  ];
  other.variants = [
    { id: "v", title: "Chủ đề A", createdBy: "A", resources: [] },
  ];
  return [mine, other];
}
function show(nodes = fixture(), admin = false) {
  const open = vi.fn();
  render(
    <PermissionContext.Provider value={{ userId: "A", admin, community: true }}>
      <MyContributions
        nodes={nodes}
        onOpenLibrary={open}
        adminPanel={<div>Quản lý thành viên riêng</div>}
      />
    </PermissionContext.Provider>,
  );
  return open;
}
beforeEach(() => {
  storage.files = [];
  storage.fail = false;
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(cleanup);
describe("Trang đóng góp cá nhân", () => {
  it("thống kê và danh sách chỉ tính tác giả gốc, không tính nội dung sửa hộ", async () => {
    show();
    await waitFor(() =>
      expect(
        screen.getByText("Ảnh đã tải lên", {
          selector: ".contribution-stat span",
        }),
      ).toBeTruthy(),
    );
    const activities = screen.getByText("Hoạt động đã tạo").closest("article")!;
    expect(within(activities).getByText("1")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Chỉ sửa hộ B" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Hoạt động A" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Chủ đề và tài nguyên/ }));
    expect(screen.getByRole("heading", { name: "Chủ đề A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tài nguyên A" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Tài nguyên B" })).toBeNull();
  });
  it("0 đóng góp có empty state rõ và nút khám phá hoạt động", () => {
    const open = show([]);
    expect(
      screen.getByRole("heading", { name: "Bạn chưa có đóng góp nào" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Khám phá thư viện" }));
    expect(open).toHaveBeenCalled();
  });
  it("xem chi tiết mở modal, nút sửa chuyển đúng node", () => {
    const open = show();
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
    expect(screen.getByRole("dialog", { name: "Hoạt động A" })).toBeTruthy();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Chỉnh sửa" }));
    expect(open).toHaveBeenCalledWith("Hoạt động A");
  });
  it("ảnh tự tải, có thumbnail, xóa đúng file và cập nhật số ảnh", async () => {
    storage.files = [
      {
        id: "img",
        name: "image-1",
        path: "A/image-1",
        url: "https://example.com/one.png",
      },
      {
        id: "img2",
        name: "image-2",
        path: "A/image-2",
        url: "https://example.com/two.png",
      },
    ];
    show();
    await waitFor(() =>
      expect(
        within(
          screen
            .getByText("Ảnh đã tải lên", {
              selector: ".contribution-stat span",
            })
            .closest("article")!,
        ).getByText("2"),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /Ảnh đã tải lên/ }));
    expect(screen.getAllByRole("img")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh 1" }));
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith("A/image-1"));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
  });
  it("lỗi Storage không hiện số ảnh 0 giả, vẫn xem được đóng góp và thử lại", async () => {
    storage.fail = true;
    show();
    await waitFor(() =>
      expect(screen.getByText("Chưa tải được số ảnh")).toBeTruthy(),
    );
    expect(
      within(
        screen
          .getByText("Ảnh đã tải lên", { selector: ".contribution-stat span" })
          .closest("article")!,
      ).getByText("—"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Ảnh đã tải lên/ }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Không đọc được ảnh",
    );
    storage.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tải lại ảnh" }));
    expect(
      await screen.findByRole("heading", { name: "Bạn chưa tải ảnh nào" }),
    ).toBeTruthy();
  });
  it("Admin có khu quản trị riêng, tab chuyển bằng bàn phím", () => {
    show(fixture(), true);
    expect(screen.queryByText("Quản lý thành viên riêng")).toBeNull();
    const first = screen.getByRole("tab", { name: /Hoạt động của tôi/ });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(
      screen
        .getByRole("tab", { name: /Chủ đề và tài nguyên/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Quản trị" }));
    expect(screen.getByText("Quản lý thành viên riêng")).toBeTruthy();
  });
});
