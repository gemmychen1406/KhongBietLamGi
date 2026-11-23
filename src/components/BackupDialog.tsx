import { useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileJson,
} from "lucide-react";
import type { AppDocument } from "../types";
import {
  parseDocument,
  readableError,
  serializeDocument,
  downloadJson,
} from "../services/storage";
import { countNodes } from "../utils/tree";
import { Modal } from "./Modal";
export function BackupDialog({
  doc,
  onImport,
  onClose,
}: {
  doc: AppDocument;
  onImport: (doc: AppDocument) => void;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<AppDocument | null>(null);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function read(file: File | undefined) {
    setPreview(null);
    setError("");
    setMessage("");
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("File quá lớn. Vui lòng chọn JSON nhỏ hơn 10 MB.");
      const parsed = parseDocument(await file.text());
      setPreview(parsed);
      setFilename(file.name);
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <Modal title="Sao lưu & khôi phục" onClose={onClose}>
      <div className="backup-content">
        <div className="backup-info">
          <ShieldCheck size={25} />
          <p>
            Dữ liệu chỉ nằm trên trình duyệt và thiết bị này, không tự đồng bộ.
            Hãy tải bản sao định kỳ, đặc biệt trước khi xóa dữ liệu trình duyệt
            hoặc đổi thiết bị.
          </p>
        </div>
        <section>
          <h3>
            <Download size={19} /> Xuất dữ liệu
          </h3>
          <p className="muted">
            Lưu toàn bộ cây hoạt động, biến thể, tài nguyên và lịch sử vào một
            file JSON.
          </p>
          <button
            className="button primary"
            onClick={() => {
              try {
                downloadJson(
                  serializeDocument(doc),
                  `hom-nay-lam-gi-${new Date().toISOString().slice(0, 10)}.json`,
                );
                setMessage(
                  "Đã tạo file sao lưu. Kiểm tra thư mục tải xuống của trình duyệt.",
                );
              } catch (e) {
                setError(readableError(e));
              }
            }}
          >
            <Download size={17} /> Tải bản sao JSON
          </button>
        </section>
        <section className="import-section">
          <h3>
            <Upload size={19} /> Nhập bản sao
          </h3>
          <p className="muted">
            Kiểm tra file trước, sau đó xác nhận thay thế dữ liệu hiện tại.
          </p>
          <label className="file-label">
            Chọn file JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {preview && (
            <div className="import-preview">
              <h4>
                <FileJson size={18} /> {filename}
              </h4>
              <p>
                {countNodes(preview.nodes).groups} nhóm ·{" "}
                {countNodes(preview.nodes).activities} hoạt động ·{" "}
                {preview.history.length} lượt lịch sử
              </p>
              <p className="warning-text">
                <AlertTriangle size={16} /> Dữ liệu hiện tại sẽ được thay thế
                hoàn toàn.
              </p>
              <button
                className="button primary"
                onClick={() => {
                  if (
                    window.confirm(
                      "Thay thế toàn bộ hoạt động và lịch sử bằng bản sao này? Hãy xuất bản sao dữ liệu hiện tại trước nếu cần.",
                    )
                  ) {
                    onImport(preview);
                    onClose();
                  }
                }}
              >
                Xác nhận khôi phục
              </button>
            </div>
          )}
        </section>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="alert success" role="status">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
