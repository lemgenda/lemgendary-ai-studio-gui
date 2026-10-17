import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { HoverPinPopover } from "../HoverPinPopover";

describe("HoverPinPopover", () => {
  it("renders unpinned popover with click-to-pin prompt", () => {
    const html = renderToStaticMarkup(
      <HoverPinPopover
        title="SOTA Targets"
        valueBadge={<span>PSNR 32.5+</span>}
        isPinned={false}
        onTogglePin={() => {}}
      >
        <div>Popover detailed metric breakdown</div>
      </HoverPinPopover>
    );

    expect(html).toContain("hover-pin-container");
    expect(html).not.toContain("is-pinned");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("(Click to pin)");
    expect(html).toContain("PSNR 32.5+");
    expect(html).toContain("Popover detailed metric breakdown");
  });

  it("renders pinned popover with is-pinned class and pinned prompt", () => {
    const html = renderToStaticMarkup(
      <HoverPinPopover
        title="Upstream Sources"
        valueBadge={<span>3 Sources</span>}
        isPinned={true}
        onTogglePin={() => {}}
      >
        <div>Kaggle, HuggingFace, GoPro</div>
      </HoverPinPopover>
    );

    expect(html).toContain("hover-pin-container is-pinned");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("(Pinned)");
    expect(html).toContain("3 Sources");
    expect(html).toContain("Kaggle, HuggingFace, GoPro");
  });
});
