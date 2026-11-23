import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  ImageOff,
  BookOpen,
  Music2,
  AlignLeft,
} from "lucide-react";
import type { Resource } from "../types";
import { isSafeUrl } from "../services/storage";
function ResourceItem({ resource: r }: { resource: Resource }) {
  const [failed, setFailed] = useState(false);
  const [copyState, setCopyState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(r.content ?? "");
      setCopyState("Đã sao chép");
    } catch {
      setCopyState(
        "Không thể sao chép tự động. Hãy chọn nội dung và sao chép thủ công.",
      );
    }
  }
  const safe = r.url && isSafeUrl(r.url);
  return (
    <div className={`resource resource-${r.type}`}>
      <div className="resource-heading">
        <span>
          {r.type === "music_sheet" ? (
            <Music2 size={17} />
          ) : r.type === "text" ? (
            <AlignLeft size={17} />
          ) : (
            <BookOpen size={17} />
          )}{" "}
          {r.title}
        </span>
        {r.type === "text" && (
          <button type="button" className="text-button" onClick={copy}>
            {copyState === "Đã sao chép" ? (
              <Check size={15} />
            ) : (
              <Copy size={15} />
            )}{" "}
            Sao chép
          </button>
        )}
      </div>
      {r.type === "image" &&
        safe &&
        (failed ? (
          <div className="image-fallback">
            <ImageOff /> Không tải được ảnh. Bạn vẫn có thể mở liên kết bên
            dưới.
          </div>
        ) : (
          <img
            src={r.url}
            alt={r.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ))}
      {r.content && <p className="preserve">{r.content}</p>}
      {safe && (
        <a
          className="resource-link"
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {r.type === "image" ? "Mở ảnh gốc" : "Mở tài nguyên"}{" "}
          <ExternalLink size={14} />
        </a>
      )}
      {copyState && <small role="status">{copyState}</small>}
    </div>
  );
}
export function Resources({ resources }: { resources: Resource[] }) {
  return (
    <div className="resources">
      {resources.map((r) => (
        <ResourceItem key={r.id} resource={r} />
      ))}
    </div>
  );
}
