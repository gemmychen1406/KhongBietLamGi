import { z } from "zod";
import type { ActivityNode, AppDocument } from "../types";
export const STORAGE_KEY = "hom-nay-lam-gi.document";
const attribution = {
  systemSeedKey: z.string().min(1).max(2000).optional(),
  createdBy: z.string().optional(),
  contributorName: z.string().optional(),
};
const title = z.string().trim().min(1).max(500);
export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
const url = z
  .string()
  .max(10000)
  .refine(
    isSafeUrl,
    "URL phải bắt đầu bằng http:// hoặc https:// và không chứa thông tin đăng nhập.",
  );
export const resourceSchema = z
  .object({
    ...attribution,
    id: title,
    type: z.enum(["text", "image", "link", "music_sheet"]),
    title,
    url: url.optional(),
    content: z.string().max(100000).optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.type === "text" ? !r.content?.trim() : !r.url)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          r.type === "text"
            ? "Tài nguyên văn bản cần có nội dung."
            : "Tài nguyên này cần URL.",
      });
  });
export const variantSchema = z
  .object({
    ...attribution,
    id: title,
    title,
    description: z.string().max(100000).optional(),
    resources: z.array(resourceSchema),
  })
  .strict();
export const nodeSchema: z.ZodType<ActivityNode> = z.lazy(() =>
  z
    .object({
      ...attribution,
      id: title,
      title,
      description: z.string().max(100000).optional(),
      kind: z.enum(["group", "activity"]),
      enabled: z.boolean(),
      children: z.array(nodeSchema),
      variants: z.array(variantSchema),
      resources: z.array(resourceSchema),
    })
    .strict()
    .superRefine((n, ctx) => {
      if (
        (n.kind === "activity" && n.children.length) ||
        (n.kind === "group" && (n.variants.length || n.resources.length))
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nhóm chỉ chứa nhóm/hoạt động; hoạt động không được có con.",
        });
    }),
);
const resultSchema = z
  .object({
    source: z.enum(["sample", "community"]).optional(),
    path: z.array(z.object({ id: title, title }).strict()).min(1),
    activity: nodeSchema,
    variant: variantSchema.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (
      r.activity.kind !== "activity" ||
      r.path.at(-1)?.id !== r.activity.id ||
      r.path.at(-1)?.title !== r.activity.title ||
      new Set(r.path.map((n) => n.id)).size !== r.path.length ||
      (r.variant &&
        !r.activity.variants.some(
          (v) => JSON.stringify(v) === JSON.stringify(r.variant),
        ))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snapshot lịch sử không hợp lệ.",
      });
  });
export const documentSchema = z
  .object({
    schemaVersion: z.literal(1),
    nodes: z.array(nodeSchema),
    history: z.array(
      z
        .object({
          id: title,
          createdAt: z.string().datetime(),
          completed: z.boolean(),
          result: resultSchema,
        })
        .strict(),
    ),
    settings: z.object({ autoSaveHistory: z.literal(true) }).strict(),
  })
  .strict();
export function parseDocument(raw: string): AppDocument {
  const input: unknown = JSON.parse(raw);
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion !== 1
  )
    throw new Error(
      "Phiên bản dữ liệu chưa được hỗ trợ. Dữ liệu hiện tại được giữ nguyên.",
    );
  const doc = documentSchema.parse(input);
  const ids = new Set<string>();
  const check = (value: string) => {
    if (ids.has(value)) throw new Error("Dữ liệu có ID trùng lặp.");
    ids.add(value);
  };
  const visit = (nodes: ActivityNode[]) =>
    nodes.forEach((n) => {
      check(n.id);
      n.resources.forEach((r) => check(r.id));
      n.variants.forEach((v) => {
        check(v.id);
        v.resources.forEach((r) => check(r.id));
      });
      visit(n.children);
    });
  visit(doc.nodes);
  doc.history.forEach((h) => check(h.id));
  return doc;
}
export function readDocument(): AppDocument | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : parseDocument(raw);
}
export function saveDocument(doc: AppDocument): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}
export function serializeDocument(doc: AppDocument): string {
  return JSON.stringify(doc, null, 2);
}
export function downloadJson(content: string, filename: string): void {
  const objectUrl = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
export function readableError(error: unknown): string {
  if (error instanceof z.ZodError)
    return `Dữ liệu không hợp lệ: ${error.issues[0]?.message ?? "Sai cấu trúc."}`;
  if (error instanceof SyntaxError)
    return "File không phải JSON hợp lệ. Dữ liệu hiện tại được giữ nguyên.";
  return error instanceof Error
    ? error.message
    : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
