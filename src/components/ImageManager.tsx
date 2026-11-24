import { useState } from "react";
import { api, communityError, publicImageUrl } from "../services/supabase";
import { deleteImage } from "../services/community";
import { usePermissions } from "../services/permissions";
export function ImageManager() {
  const { userId, admin } = usePermissions();
  const [prefix, setPrefix] = useState(userId ?? "");
  const [files, setFiles] = useState<{ name: string; id: string | null }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const rows: typeof files = [];
      for (let offset = 0; ; offset += 100) {
        const batch = await api<typeof files>(
          "/storage/v1/object/list/activity-images",
          {
            method: "POST",
            body: JSON.stringify({
              prefix,
              limit: 100,
              offset,
              sortBy: { column: "name", order: "asc" },
            }),
          },
        );
        rows.push(...batch);
        if (batch.length < 100) break;
      }
      setFiles(rows);
      if (!rows.length) setMessage("Thư mục chưa có ảnh.");
    } catch (e) {
      setMessage(communityError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!userId) return null;
  return (
    <section className="panel">
      <h2>Ảnh đã tải lên</h2>
      <p>
        Ảnh tải lên được lưu ngay. Nếu bỏ form chưa lưu, bạn có thể xóa ảnh thừa
        tại đây.
      </p>
      {admin && (
        <label>
          Thư mục người dùng (UUID)
          <input
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value);
              setFiles([]);
            }}
          />
        </label>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        Xem ảnh trong thư mục
      </button>
      <ul>
        {files
          .filter((f) => f.id)
          .map((f) => (
            <li key={f.name}>
              <a
                href={publicImageUrl(`${prefix}/${f.name}`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {f.name}
              </a>{" "}
              <button
                className="text-button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Xóa file ảnh vĩnh viễn? Mọi liên kết đang dùng ảnh này sẽ không còn tải được.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await deleteImage(`${prefix}/${f.name}`);
                    setFiles((fs) => fs.filter((x) => x.name !== f.name));
                    setMessage("Đã xóa ảnh.");
                  } catch (e) {
                    setMessage(communityError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Xóa ảnh
              </button>
            </li>
          ))}
      </ul>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
