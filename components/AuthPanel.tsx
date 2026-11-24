import { useState } from "react";
import {
  communityError,
  signIn,
  signUp,
  signOut,
  resendConfirmation,
  type Session,
} from "../services/supabase";
export function AuthPanel({
  session,
  admin,
}: {
  session: Session | null;
  admin: boolean;
}) {
  const [register, setRegister] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      const loggedIn = register
        ? await signUp(email, password, String(form.get("name")))
        : await signIn(email, password);
      setMessage(
        loggedIn
          ? "Đã đăng nhập."
          : "Đã gửi yêu cầu đăng ký. Hãy kiểm tra email xác nhận, rồi đăng nhập.",
      );
    } catch (e) {
      setMessage(communityError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-panel" aria-label="Tài khoản">
      {session ? (
        <>
          <span>
            {session.user.email} · {admin ? "Admin" : "Member"}
          </span>
          <button
            className="button small secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
                setMessage("Đã đăng xuất.");
              } catch (e) {
                setMessage(communityError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Đăng xuất
          </button>
        </>
      ) : (
        <>
          <span>Khách có thể xem và random. Đăng nhập để đóng góp.</span>
          <button
            className="button small secondary"
            onClick={() => setOpen(!open)}
          >
            Đăng nhập / Đăng ký
          </button>
        </>
      )}
      {!session && open && (
        <form className="editor-form" onSubmit={submit}>
          <h3>{register ? "Đăng ký tài khoản" : "Đăng nhập"}</h3>
          {register && (
            <label>
              Tên hiển thị
              <input name="name" required maxLength={100} />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Đang xử lý…" : register ? "Đăng ký" : "Đăng nhập"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={async (event) => {
              const input =
                event.currentTarget.form?.elements.namedItem("email");
              if (
                !(input instanceof HTMLInputElement) ||
                !input.reportValidity()
              )
                return;
              setBusy(true);
              setMessage("");
              try {
                await resendConfirmation(input.value);
                setMessage(
                  "Đã gửi yêu cầu gửi lại email. Nếu tài khoản đang chờ xác nhận, hãy kiểm tra thư mới nhất, kể cả mục spam.",
                );
              } catch (error) {
                setMessage(communityError(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            Gửi lại email xác nhận
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setMessage("");
            }}
          >
            {register ? "Đã có tài khoản" : "Tạo tài khoản mới"}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
