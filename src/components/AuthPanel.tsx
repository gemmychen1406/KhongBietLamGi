import { useState, useEffect, useCallback } from "react";
import { UserRound, LogOut, ArrowRight } from "lucide-react";
import { Modal } from "./Modal";
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
  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  useEffect(() => {
    if (session) {
      setOpen(false);
      setMessage("");
    }
  }, [session]);
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
    <section className="account-area" aria-label="Tài khoản">
      {session ? (
        <>
          <div className="account-identity" title={session.user.email}>
            <span className="account-avatar" aria-hidden="true">
              <UserRound size={17} />
            </span>
            <span className="account-name">
              {session.user.email?.split("@")[0] || "Tài khoản"}
            </span>
            <span className="account-role">
              {admin ? "Quản trị viên" : "Thành viên"}
            </span>
          </div>
          <button
            className="button small secondary account-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
                setMessage("");
              } catch (e) {
                setMessage(communityError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={15} /> <span>Đăng xuất</span>
          </button>
        </>
      ) : (
        <>
          <span className="account-hint">Cùng góp một ý tưởng?</span>
          <button
            className="button small soft account-button"
            onClick={() => {
              setMessage("");
              setOpen(true);
            }}
          >
            <UserRound size={16} /> Đăng nhập / Đăng ký
          </button>
        </>
      )}
      {!session && open && (
        <Modal
          title={register ? "Đăng ký tài khoản" : "Chào bạn, mừng bạn ghé lại"}
          onClose={close}
        >
          <form className="editor-form" onSubmit={submit}>
            <p className="auth-intro">
              Random luôn miễn phí và không cần tài khoản. Đăng nhập để thêm
              những ý tưởng của bạn vào thư viện chung.
            </p>
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
            {message && (
              <p role="status" className="auth-message">
                {message}
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={16} />
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
        </Modal>
      )}
      {session && message && (
        <p role="status" className="account-error">
          {message}
        </p>
      )}
    </section>
  );
}
