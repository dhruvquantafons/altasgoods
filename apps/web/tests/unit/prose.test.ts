import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Prose } from "@/components/store/prose";

const html = (markdown: string) => renderToStaticMarkup(createElement(Prose, { markdown }));

describe("Prose", () => {
  it("renders a GitHub-style table with headers and rows", () => {
    const out = html("| Category | Window |\n| --- | --- |\n| Fashion | 10 days |\n| Grocery | 2 days |");
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out.match(/<th /g)).toHaveLength(2);
    expect(out.match(/<td /g)).toHaveLength(4);
    expect(out).toContain("10 days");
  });

  it("shows raw HTML as text instead of running it", () => {
    const out = html("Hello <script>alert(1)</script> world\n\n<img src=x onerror=alert(1)>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders lists, numbered steps and a note", () => {
    const out = html("- one\n- two\n\n1. **First.** go\n2. **Second.** stop\n\n> **Note:** careful");
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out).toContain("<blockquote");
    expect(out).toContain("<strong");
  });

  it("opens site paths in place and outside links safely in a new tab", () => {
    const out = html("[Returns](/policies/returns) and [Gov](https://example.gov.in) and [mail](mailto:help@altasgoods.in)");
    expect(out).toContain('href="/policies/returns"');
    expect(out).not.toMatch(/href="\/policies\/returns"[^>]*target/);
    expect(out).toMatch(/href="https:\/\/example\.gov\.in"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  });

  it("drops javascript links and images", () => {
    const out = html("[bad](javascript:alert(1)) ![pic](https://evil.example/a.png)");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<img");
  });
});
