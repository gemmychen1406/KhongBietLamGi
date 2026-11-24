import { afterEach, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Resources } from "../src/components/Resources";
afterEach(cleanup);
it("ảnh lỗi có fallback và liên kết an toàn; đổi URL thì thử tải ảnh mới", () => {
  const resource = {
    id: "image",
    type: "image" as const,
    title: "Ảnh tham khảo",
    url: "https://example.com/old.png",
  };
  const view = render(<Resources resources={[resource]} />);
  fireEvent.error(screen.getByRole("img", { name: "Ảnh tham khảo" }));
  expect(screen.queryByRole("img")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Mở ảnh gốc" }).getAttribute("rel"),
  ).toBe("noopener noreferrer");
  view.rerender(
    <Resources
      resources={[{ ...resource, url: "https://example.com/new.png" }]}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Ảnh tham khảo" }).getAttribute("src"),
  ).toBe("https://example.com/new.png");
});
