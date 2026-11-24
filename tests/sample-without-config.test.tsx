import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, fireEvent, screen } from "@testing-library/react";
vi.mock("../src/services/supabase", async (original) => ({
  ...(await original<typeof import("../src/services/supabase")>()),
  configured: false,
  getSession: () => null,
  onSession: () => () => {},
}));
vi.mock("../src/services/community", () => ({
  loadLibrary: vi.fn(),
  saveLibrary: vi.fn(),
}));
import App, { PERSONAL_KEY } from "../src/App";
import { loadLibrary } from "../src/services/community";
import { parseDocument } from "../src/services/storage";
afterEach(cleanup);
it("không cấu hình Supabase: khách vẫn chọn nhóm, random mẫu và lưu snapshot chưa đồng bộ", () => {
  localStorage.clear();
  window.history.replaceState(null, "", "/#random");
  render(<App />);
  expect(screen.getByText("Mẫu cục bộ")).toBeTruthy();
  expect(screen.getByText("Chỉ đọc · Chưa đồng bộ")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Thông tin nguồn dữ liệu"));
  expect(screen.getByText(/Chưa kết nối Supabase/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Nội trợ" }));
  fireEvent.click(screen.getByRole("button", { name: "Random ngay!" }));
  const entry = parseDocument(localStorage.getItem(PERSONAL_KEY)!).history[0];
  expect(entry.result.path[0].title).toBe("Nội trợ");
  expect(entry.result.source).toBe("sample");
  expect(loadLibrary).not.toHaveBeenCalled();
});
