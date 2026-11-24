import { afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
vi.mock("../src/services/community", () => ({ uploadImage: vi.fn() }));
import { uploadImage } from "../src/services/community";
import { NodeEditor } from "../src/components/NodeEditor";
import { PermissionContext } from "../src/services/permissions";
import type { ActivityNode } from "../src/types";
afterEach(cleanup);
it("Member sửa ảnh của B: không lưu dở dang hoặc thay tác giả trong lúc upload", async () => {
  let resolve!: (url: string) => void;
  vi.mocked(uploadImage).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const save = vi.fn();
  const node: ActivityNode = {
    id: "n",
    title: "B",
    createdBy: "B",
    revision: 2,
    kind: "activity",
    enabled: true,
    children: [],
    variants: [],
    resources: [
      {
        id: "r",
        title: "Ảnh B",
        type: "image",
        createdBy: "B",
        revision: 1,
        url: "https://example.com/old.png",
      },
    ],
  };
  render(
    <PermissionContext.Provider
      value={{ userId: "A", admin: false, community: true }}
    >
      <NodeEditor
        node={node}
        isNew={false}
        parentName="Nhóm"
        onSave={save}
        onClose={() => {}}
      />
    </PermissionContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText("Tải ảnh lên (tối đa 5 MB)"), {
    target: { files: [new File(["image"], "new.png", { type: "image/png" })] },
  });
  expect(
    (screen.getByRole("button", { name: "Lưu thay đổi" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.submit(
    screen.getByRole("button", { name: "Lưu thay đổi" }).closest("form")!,
  );
  expect(save).not.toHaveBeenCalled();
  resolve("https://example.com/new.png");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Lưu thay đổi",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  const result = save.mock.calls[0][0] as ActivityNode;
  expect(result.createdBy).toBe("B");
  expect(result.resources[0].createdBy).toBe("B");
  expect(result.resources[0].url).toBe("https://example.com/new.png");
});
