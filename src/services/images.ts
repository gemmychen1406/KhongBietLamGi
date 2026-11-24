import { api, publicImageUrl } from "./supabase";
export interface UploadedImage {
  id: string;
  name: string;
  path: string;
  url: string;
  createdAt?: string;
  size?: number;
}
interface StorageEntry {
  id: string | null;
  name: string;
  created_at?: string;
  metadata?: { size?: number };
}
export async function listUploadedImages(
  prefix: string,
): Promise<UploadedImage[]> {
  if (!prefix || prefix.includes("/") || prefix === "." || prefix === "..")
    throw new Error("Thư mục ảnh không hợp lệ.");
  const files: UploadedImage[] = [];
  for (let offset = 0; ;) {
    const batch = await api<StorageEntry[]>(
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
    if (!Array.isArray(batch)) throw new Error("Không đọc được danh sách ảnh.");
    if (!batch.length) return files;
    for (const file of batch)
      if (file.id) {
        const path = `${prefix}/${file.name}`;
        files.push({
          id: file.id,
          name: file.name,
          path,
          url: publicImageUrl(path),
          createdAt: file.created_at,
          size: file.metadata?.size,
        });
      }
    offset += batch.length;
  }
}
