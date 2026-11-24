import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
vi.mock("../src/services/supabase", () => ({
  signIn: vi.fn(async () => true),
  signUp: vi.fn(async () => false),
  signOut: vi.fn(async () => {}),
  resendConfirmation: vi.fn(async () => {}),
  communityError: (e: unknown) =>
    e instanceof Error ? e.message : "Có lỗi xảy ra",
}));
import { AuthPanel } from "../src/components/AuthPanel";
import { signIn, signOut, resendConfirmation } from "../src/services/supabase";
const session = {
  access_token: "test",
  refresh_token: "test",
  expires_at: 9999999999,
  user: { id: "A", email: "ban@example.com" },
};
afterEach(cleanup);
describe("Thanh tài khoản và hộp thoại đăng nhập", () => {
  it("mở form trong modal, đăng nhập thành công thì đóng và không để thông báo thừa trên thanh", async () => {
    const view = render(<AuthPanel session={null} admin={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập / Đăng ký" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ban@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("ban@example.com", "password123"),
    );
    view.rerender(<AuthPanel session={session} admin={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Thành viên")).toBeTruthy();
    expect(screen.queryByText("Đã đăng nhập.")).toBeNull();
  });
  it("gửi lại email chỉ yêu cầu email hợp lệ, không yêu cầu nhập mật khẩu", async () => {
    render(<AuthPanel session={null} admin={false} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Đăng nhập / Đăng ký" }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ban@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi lại email xác nhận" }),
    );
    await waitFor(() =>
      expect(resendConfirmation).toHaveBeenCalledWith("ban@example.com"),
    );
    expect(await screen.findByRole("status")).toBeTruthy();
  });
  it("đăng xuất vẫn hoạt động trên thanh tài khoản gọn", async () => {
    render(<AuthPanel session={session} admin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });
});
