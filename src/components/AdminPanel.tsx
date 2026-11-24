import { ShieldCheck } from "lucide-react";
import { AdminImageManager } from "./ImageManager";
import { useState } from "react";
import { api, communityError } from "../services/supabase";
export function AdminPanel({ onRoleChange }: { onRoleChange: () => void }) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<
    { id: string; display_name: string; role: string }[]
  >([]);
  return (
    <section className="admin-management" aria-label="Quản trị cộng đồng">
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!window.confirm(`Đổi quyền tài khoản ${target} thành ${role}?`))
            return;
          setBusy(true);
          setMessage("");
          try {
            await api("/rest/v1/rpc/set_member_role", {
              method: "POST",
              body: JSON.stringify({ target_user: target, new_role: role }),
            });
            setProfiles((current) =>
              current.map((p) => (p.id === target ? { ...p, role } : p)),
            );
            setMessage("Đã cập nhật quyền.");
            onRoleChange();
          } catch (error) {
            setMessage(communityError(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="contribution-section-heading">
          <div>
            <h2>
              <ShieldCheck size={20} /> Quản lý thành viên
            </h2>
            <p>Khu vực quản trị riêng dành cho Admin.</p>
          </div>
        </div>
        <p>
          Database kiểm tra quyền hiện tại; không thể hạ quyền Admin cuối cùng.
        </p>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result: typeof profiles = [];
              for (let offset = 0; ;) {
                const batch = await api<typeof profiles>(
                  `/rest/v1/profiles?select=id,display_name,role&order=id&limit=500&offset=${offset}`,
                );
                if (!batch.length) break;
                result.push(...batch);
                offset += batch.length;
              }
              setProfiles(result);
            } catch (e) {
              setMessage(communityError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Xem thành viên
        </button>
        <ul>
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setTarget(p.id);
                  setRole(p.role);
                }}
              >
                {p.display_name} ·{" "}
                {p.role === "admin" ? "Quản trị viên" : "Thành viên"}
              </button>
              <small className="member-id">{p.id}</small>
            </li>
          ))}
        </ul>
        <label>
          ID thành viên
          <input
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            pattern="[0-9a-fA-F-]{36}"
          />
        </label>
        <label>
          Vai trò
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Thành viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </label>
        <button className="button primary" disabled={busy}>
          Cập nhật quyền
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <AdminImageManager />
    </section>
  );
}
