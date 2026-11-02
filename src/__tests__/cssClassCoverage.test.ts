import { describe, it, expect } from "vitest";
import indexCss from "../index.css?raw";

/**
 * Every class name the components use must have a rule in `src/index.css`;
 * an undefined class renders unstyled (for example an uncoloured FAILED badge).
 *
 * Collected class names (deterministic, regex based):
 * 1. static `className="a b"` literals;
 * 2. ternary results (`? "x"` / `: "x"`) inside `className={...}` expressions;
 * 3. any string literal shaped like a badge, button or log modifier
 *    (`"badge-x"`, `"btn-x"`, `"log-x"`), which catches classes picked in a variable first.
 * Template placeholders (`${...}`) are dropped, so dynamic prefixes are not checked.
 */
const sources = import.meta.glob<string>(["../**/*.tsx", "!../**/__tests__/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const MODIFIER_LITERAL = /["'`]((?:badge|btn|log)-[a-z0-9-]+)["'`]/g;
const STATIC_CLASSNAME = /className="([^"]*)"/g;
const EXPRESSION_CLASSNAME = /className=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
const TERNARY_RESULT = /[?:]\s*"([^"]*)"/g;

function definedClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set<string>();
  for (const match of withoutComments.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
    names.add(match[1]);
  }
  return names;
}

function usedClasses(source: string): Set<string> {
  const names = new Set<string>();
  const add = (text: string) => {
    for (const token of text.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
      if (/^[A-Za-z_][\w-]*$/.test(token)) names.add(token);
    }
  };
  for (const match of source.matchAll(STATIC_CLASSNAME)) add(match[1]);
  for (const match of source.matchAll(EXPRESSION_CLASSNAME)) {
    for (const result of match[1].matchAll(TERNARY_RESULT)) add(result[1]);
  }
  for (const match of source.matchAll(MODIFIER_LITERAL)) add(match[1]);
  return names;
}

describe("CSS class coverage", () => {
  it("loads the component sources and the stylesheet", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    // An empty stylesheet means vitest.config.ts no longer includes src/index.css.
    expect(definedClasses(indexCss).size).toBeGreaterThan(50);
  });

  it("defines every className used in TSX in src/index.css", () => {
    const defined = definedClasses(indexCss);
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const name of usedClasses(source)) {
        if (!defined.has(name)) missing.push(`${name} (${file})`);
      }
    }
    expect(missing.sort()).toEqual([]);
  });

  it("detects a class picked in a variable or ternary", () => {
    const sample = 'let c = "badge-ghost"; <span className={`badge ${ok ? "badge-success" : "badge-nope"}`} />';
    expect([...usedClasses(sample)].sort()).toEqual(["badge-ghost", "badge-nope", "badge-success"]);
  });
});
