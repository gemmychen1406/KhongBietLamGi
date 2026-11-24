import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
export function ImagePreview({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return failed ? (
    <div className="image-preview-fallback">
      <ImageOff size={24} />
      <span>Không tải được ảnh</span>
    </div>
  ) : (
    <img
      className="image-preview"
      src={url}
      alt={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
