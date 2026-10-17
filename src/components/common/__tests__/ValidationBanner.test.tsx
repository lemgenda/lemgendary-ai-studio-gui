import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { ValidationBanner } from "../ValidationBanner";

describe("ValidationBanner", () => {
  it("renders explicit error type and alert role", () => {
    const html = renderToStaticMarkup(
      <ValidationBanner type="error" message="Hardware fault detected" />
    );
    expect(html).toContain("banner-error");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Hardware fault detected");
  });

  it("renders explicit success type and status role", () => {
    const html = renderToStaticMarkup(
      <ValidationBanner type="success" message="Model variations staged successfully" />
    );
    expect(html).toContain("banner-success");
    expect(html).toContain('role="status"');
    expect(html).toContain("Model variations staged successfully");
  });

  it("auto-detects error keywords and assigns error banner class", () => {
    const html = renderToStaticMarkup(
      <ValidationBanner message="Invalid YAML syntax detected in manifest" />
    );
    expect(html).toContain("banner-error");
    expect(html).toContain('role="alert"');
  });

  it("auto-detects success keywords and assigns success banner class", () => {
    const html = renderToStaticMarkup(
      <ValidationBanner message="All 23 models passed validation checks" />
    );
    expect(html).toContain("banner-success");
    expect(html).toContain('role="status"');
  });

  it("renders dismiss button with accessibility label when onDismiss is provided", () => {
    const html = renderToStaticMarkup(
      <ValidationBanner message="Dismissible warning" type="warning" onDismiss={() => {}} />
    );
    expect(html).toContain("banner-warning");
    expect(html).toContain('aria-label="Dismiss banner"');
  });
});
