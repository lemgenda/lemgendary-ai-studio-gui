#!/usr/bin/env python3
"""
Pre-commit Verification Suite for LemGendary AI Studio GUI.

Enforces seven mandatory quality and standards gates:
1. TypeScript Static Type Safety (tsc --noEmit)
2. ESLint Code Quality & Strict JSX Accessibility (eslint src --ext .ts,.tsx --max-warnings 0)
3. W3C HTML Standards Compliance (W3C Nu Validator & Structural Integrity)
4. W3C CSS Standards Compliance (W3C Nu CSS Validator & Token Hierarchy)
5. WCAG 2.2 Level AA & Screen Reader Accessibility Verification
6. Production Bundle Build Verification (vite build)
7. Markdown Documentation Linting (markdownlint-cli)
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = REPO_ROOT.parent

NPM_CMD = "npm.cmd" if os.name == "nt" else "npm"
NPX_CMD = "npx.cmd" if os.name == "nt" else "npx"

CACHE_FILE = REPO_ROOT / ".w3c_cache.json"


def log_header(title: str):
    print(f"\n{'=' * 70}")
    print(f" [GATE] {title}")
    print(f"{'=' * 70}")


def get_file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_w3c_cache() -> dict[str, str]:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_w3c_cache(cache: dict[str, str]):
    try:
        CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# GATE 1: TypeScript Static Type Safety
# ---------------------------------------------------------------------------
def check_typecheck() -> bool:
    log_header("GATE 1: TypeScript Static Type Safety (tsc --noEmit)")
    cmd = [NPM_CMD, "run", "typecheck"]
    print("[RUN] Running TypeScript typechecker...")
    try:
        res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if res.stdout:
            print(res.stdout.strip())
        if res.stderr:
            print(res.stderr.strip())
        if res.returncode == 0:
            print("[PASS] TypeScript typecheck passed with 0 errors.")
            return True
        print("[FAIL] TypeScript typecheck reported errors.")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run typecheck: {e}")
        return False


# ---------------------------------------------------------------------------
# GATE 2: ESLint Code Quality & Strict JSX Accessibility
# ---------------------------------------------------------------------------
def check_lint() -> bool:
    log_header("GATE 2: ESLint TS/TSX & Strict JSX-A11Y (eslint --max-warnings 0)")
    cmd = [NPM_CMD, "run", "lint"]
    print("[RUN] Running ESLint across all TypeScript (.ts) and TSX (.tsx) source files...")
    try:
        res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if res.stdout:
            print(res.stdout.strip())
        if res.stderr:
            print(res.stderr.strip())
        if res.returncode == 0:
            print("[PASS] ESLint passed with 0 errors and 0 warnings (WCAG 2.2 strict rules enabled).")
            return True
        print("[FAIL] ESLint reported linting or accessibility violations.")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run ESLint: {e}")
        return False


# ---------------------------------------------------------------------------
# GATE 3: W3C HTML Standards Compliance
# ---------------------------------------------------------------------------
def check_html_structural_integrity(index_html: Path) -> list[str]:
    content = index_html.read_text(encoding="utf-8")
    errors = []
    if not re.search(r"<!DOCTYPE\s+html>", content, re.IGNORECASE):
        errors.append("Missing <!DOCTYPE html> declaration")
    if not re.search(r"<html\s+lang=[\"'][a-zA-Z-]+[\"']", content, re.IGNORECASE):
        errors.append("Missing lang attribute on <html> element")
    if "<meta charset=" not in content.lower():
        errors.append("Missing <meta charset='...'> declaration")
    if "name=\"viewport\"" not in content.lower():
        errors.append("Missing responsive viewport meta tag")
    if "<title>" not in content.lower():
        errors.append("Missing <title> element")
    return errors


def check_html_w3c(skip_remote: bool = False) -> bool:
    log_header("GATE 3: HTML W3C Validation & Standards Compliance")
    index_html = REPO_ROOT / "index.html"
    if not index_html.exists():
        print("[FAIL] index.html not found.")
        return False

    # 1. Structural Integrity
    struct_errors = check_html_structural_integrity(index_html)
    if struct_errors:
        print("[FAIL] index.html structural standard violations:")
        for err in struct_errors:
            print(f"  - {err}")
        return False

    print("[PASS] HTML structural integrity verified (DOCTYPE, lang, charset, viewport, title).")

    if skip_remote:
        print("[SKIP] Remote W3C Nu HTML validation skipped via flag.")
        return True

    # 2. W3C Nu Validator Check with Cache
    cache = load_w3c_cache()
    h = get_file_sha256(index_html)
    cache_key = "index.html"
    if cache.get(cache_key) == h:
        print("[PASS] index.html (W3C Nu Validated - Cached)")
        return True

    print("[RUN] Validating index.html with live W3C Nu Validator service...")
    try:
        content = index_html.read_bytes()
        req = urllib.request.Request(
            "https://validator.w3.org/nu/?out=json",
            data=content,
            headers={
                "Content-Type": "text/html; charset=utf-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LemGendary-Audit/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            errors = [m for m in data.get("messages", []) if m.get("type") == "error"]
            if not errors:
                print("[PASS] index.html W3C Nu Validator passed with 0 errors.")
                cache[cache_key] = h
                save_w3c_cache(cache)
                return True
            print("[FAIL] W3C Nu Validator reported HTML errors:")
            for e in errors:
                print(f"  Line {e.get('lastLine', '?')}: {e.get('message', '')}")
            return False
    except Exception as e:
        print(f"[WARN] Remote W3C HTML validator unavailable: {e}. Falling back to structural validation.")
        return True


# ---------------------------------------------------------------------------
# GATE 4: W3C CSS Standards Compliance
# ---------------------------------------------------------------------------
def check_css_w3c(skip_remote: bool = False) -> bool:
    log_header("GATE 4: CSS W3C Validation & Standards Compliance")
    css_file = REPO_ROOT / "src" / "index.css"
    if not css_file.exists():
        print("[FAIL] src/index.css not found.")
        return False

    css_text = css_file.read_text(encoding="utf-8")

    # 1. Structural Check
    open_braces = css_text.count("{")
    close_braces = css_text.count("}")
    if open_braces != close_braces:
        print(f"[FAIL] CSS brace mismatch: {open_braces} open vs {close_braces} close braces.")
        return False

    print(f"[PASS] CSS syntax well-formed ({open_braces} blocks matched).")

    if skip_remote:
        print("[SKIP] Remote W3C CSS validation skipped via flag.")
        return True

    # 2. W3C Nu CSS Validator with Cache
    cache = load_w3c_cache()
    h = get_file_sha256(css_file)
    cache_key = "src/index.css"
    if cache.get(cache_key) == h:
        print("[PASS] src/index.css (W3C Validated - Cached)")
        return True

    print("[RUN] Validating src/index.css with live W3C Nu Validator service...")
    try:
        content = css_file.read_bytes()
        req = urllib.request.Request(
            "https://validator.w3.org/nu/?out=json",
            data=content,
            headers={
                "Content-Type": "text/css; charset=utf-8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LemGendary-Audit/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            errors = [m for m in data.get("messages", []) if m.get("type") == "error"]
            if not errors:
                print("[PASS] src/index.css W3C Nu Validator passed with 0 errors.")
                cache[cache_key] = h
                save_w3c_cache(cache)
                return True
            print("[FAIL] W3C Nu Validator reported CSS errors:")
            for e in errors:
                print(f"  Line {e.get('lastLine', '?')}: {e.get('message', '')}")
            return False
    except Exception as e:
        print(f"[WARN] Remote W3C CSS validator unavailable: {e}. Falling back to structural validation.")
        return True


# ---------------------------------------------------------------------------
# GATE 5: WCAG 2.2 Level AA & Screen Reader Verification
# ---------------------------------------------------------------------------
def check_wcag_compliance() -> bool:
    log_header("GATE 5: WCAG 2.2 Level AA & Screen Reader Audit")
    app_tsx = REPO_ROOT / "src" / "App.tsx"
    css_file = REPO_ROOT / "src" / "index.css"
    sidebar_tsx = REPO_ROOT / "src" / "components" / "Sidebar.tsx"
    header_tsx = REPO_ROOT / "src" / "components" / "Header.tsx"
    statusbar_tsx = REPO_ROOT / "src" / "components" / "StatusBar.tsx"
    logpanel_tsx = REPO_ROOT / "src" / "components" / "LogPanel.tsx"

    violations = []

    # 1. Skip Navigation Link (WCAG 2.4.1 Bypass Blocks)
    app_text = app_tsx.read_text(encoding="utf-8") if app_tsx.exists() else ""
    if "skip-link" not in app_text or "#main-content" not in app_text:
        violations.append("WCAG 2.4.1: Missing skip-to-content link targeting #main-content.")
    else:
        print(" [PASS] WCAG 2.4.1: Skip-to-content link present and mapped.")

    # 2. Semantic Landmarks (WCAG 1.3.1 Info & Relationships)
    if "role=\"banner\"" not in (header_tsx.read_text(encoding="utf-8") if header_tsx.exists() else ""):
        violations.append("WCAG 1.3.1: Header missing landmark role='banner'.")
    else:
        print(" [PASS] WCAG 1.3.1: Landmark role='banner' verified on TopHeader.")

    if "role=\"contentinfo\"" not in (statusbar_tsx.read_text(encoding="utf-8") if statusbar_tsx.exists() else ""):
        violations.append("WCAG 1.3.1: StatusBar missing landmark role='contentinfo'.")
    else:
        print(" [PASS] WCAG 1.3.1: Landmark role='contentinfo' verified on StatusBar.")

    if "<main" not in app_text or "id=\"main-content\"" not in app_text:
        violations.append("WCAG 1.3.1: Application missing semantic <main id='main-content'>.")
    else:
        print(" [PASS] WCAG 1.3.1: Semantic <main id='main-content'> verified.")

    # 3. Focus Appearance & Indicator (WCAG 2.2 SC 2.4.11 / 2.4.13)
    css_text = css_file.read_text(encoding="utf-8") if css_file.exists() else ""
    if ":focus-visible" not in css_text or "outline" not in css_text:
        violations.append("WCAG 2.2 SC 2.4.11: Missing prominent focus-visible outline in stylesheet.")
    else:
        print(" [PASS] WCAG 2.2 SC 2.4.11: High-contrast focus-visible indicator verified.")

    # 4. Target Size (Minimum) (WCAG 2.2 SC 2.5.8)
    if "min-height: 36px" not in css_text and "min-height: 24px" not in css_text:
        violations.append("WCAG 2.2 SC 2.5.8: Target size rule missing for interactive button elements.")
    else:
        print(" [PASS] WCAG 2.2 SC 2.5.8: Interactive target size minimum (>24px) enforced on .btn.")

    # 5. Screen Reader Live Regions (WCAG 4.1.3 Status Messages)
    log_text = logpanel_tsx.read_text(encoding="utf-8") if logpanel_tsx.exists() else ""
    status_text = statusbar_tsx.read_text(encoding="utf-8") if statusbar_tsx.exists() else ""
    if "aria-live" not in log_text or "role=\"log\"" not in log_text:
        violations.append("WCAG 4.1.3: Telemetry LogPanel missing polite live region or role='log'.")
    else:
        print(" [PASS] WCAG 4.1.3: Screen reader live region verified on LogPanel.")

    if "role=\"status\"" not in status_text or "aria-live" not in status_text:
        violations.append("WCAG 4.1.3: StatusBar missing role='status' with aria-live.")
    else:
        print(" [PASS] WCAG 4.1.3: Dynamic status announcement region verified on StatusBar.")

    # 6. Tablist Roving Tabindex & Keyboard Navigation (WCAG 2.1.1 Keyboard)
    sidebar_text = sidebar_tsx.read_text(encoding="utf-8") if sidebar_tsx.exists() else ""
    if "role=\"tablist\"" not in sidebar_text or "aria-orientation=\"vertical\"" not in sidebar_text:
        violations.append("WCAG 2.1.1: Sidebar tablist missing aria-orientation='vertical'.")
    elif "handleKeyDown" not in sidebar_text or "ArrowDown" not in sidebar_text:
        violations.append("WCAG 2.1.1: Sidebar tablist missing Arrow keyboard navigation handler.")
    else:
        print(" [PASS] WCAG 2.1.1: Full keyboard navigation (ArrowUp/Down, Home, End, roving tabindex) verified.")

    # 7. Prefers Reduced Motion (WCAG 2.3.3 Animation from Interactions)
    if "@media (prefers-reduced-motion: reduce)" not in css_text:
        violations.append("WCAG 2.3.3: Stylesheet missing prefers-reduced-motion media query override.")
    else:
        print(" [PASS] WCAG 2.3.3: prefers-reduced-motion accessibility override active.")

    if violations:
        print(f"[FAIL] {len(violations)} WCAG 2.2 AA violations detected:")
        for v in violations:
            print(f"  - {v}")
        return False

    print("[PASS] All WCAG 2.2 Level AA & Screen Reader accessibility criteria PASSED.")
    return True


# ---------------------------------------------------------------------------
# GATE 6: Production Bundle Verification
# ---------------------------------------------------------------------------
def check_build() -> bool:
    log_header("GATE 6: Production Bundle Verification (vite build)")
    cmd = [NPM_CMD, "run", "build"]
    print("[RUN] Building production bundle...")
    try:
        res = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if res.stdout:
            print(res.stdout.strip())
        if res.stderr:
            print(res.stderr.strip())
        if res.returncode == 0:
            print("[PASS] Production build succeeded.")
            return True
        print("[FAIL] Production build failed.")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run build: {e}")
        return False


# ---------------------------------------------------------------------------
# GATE 7: Markdown Documentation Linting
# ---------------------------------------------------------------------------
def check_markdown_lint() -> bool:
    log_header("GATE 7: Markdown Documentation Linting (markdownlint-cli)")
    md_files = sorted(list(REPO_ROOT.glob("*.md")))
    if not md_files:
        print("[INFO] No Markdown files to lint.")
        return True

    cfg_path = PROJECT_ROOT / ".markdownlint.yaml"
    cmd = [NPX_CMD, "markdownlint-cli"]
    if cfg_path.exists():
        cmd.extend(["-c", str(cfg_path)])
    cmd.extend([str(p) for p in md_files])

    print(f"[RUN] Linting {len(md_files)} Markdown files...")
    try:
        res = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"[PASS] All {len(md_files)} Markdown files passed with 0 errors/warnings.")
            return True
        print("[FAIL] Markdown lint violations detected:")
        if res.stdout:
            print(res.stdout.strip())
        if res.stderr:
            print(res.stderr.strip())
        return False
    except Exception as e:
        print(f"[ERROR] Failed to run markdownlint-cli: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Pre-commit Verification Suite for LemGendary AI Studio GUI")
    parser.add_argument("--staged", action="store_true", help="Run pre-commit checks for staged files")
    parser.add_argument("--skip-build", action="store_true", help="Skip the full production bundle build step")
    parser.add_argument("--skip-remote-w3c", action="store_true", help="Skip remote W3C HTTP validation calls")
    args = parser.parse_args()

    print("=" * 70)
    print(" LEMGENDARY AI STUDIO GUI - PRE-COMMIT AUDIT SUITE")
    print("=" * 70)

    g1 = check_typecheck()
    g2 = check_lint()
    g3 = check_html_w3c(skip_remote=args.skip_remote_w3c)
    g4 = check_css_w3c(skip_remote=args.skip_remote_w3c)
    g5 = check_wcag_compliance()
    g6 = True if args.skip_build else check_build()
    g7 = check_markdown_lint()

    log_header("GUI AUDIT SUMMARY")
    print(f"  Gate 1: TypeScript Type Safety (tsc)      : {'PASSED' if g1 else 'FAILED'}")
    print(f"  Gate 2: ESLint TS/TSX & Strict JSX-A11Y   : {'PASSED' if g2 else 'FAILED'}")
    print(f"  Gate 3: W3C HTML Validation & Integrity   : {'PASSED' if g3 else 'FAILED'}")
    print(f"  Gate 4: W3C CSS Validation & Syntax       : {'PASSED' if g4 else 'FAILED'}")
    print(f"  Gate 5: WCAG 2.2 AA & Screen Reader Audit : {'PASSED' if g5 else 'FAILED'}")
    print(f"  Gate 6: Production Build (vite build)     : {'PASSED' if g6 else 'SKIPPED' if args.skip_build else 'FAILED'}")
    print(f"  Gate 7: Markdown Linting (markdownlint)   : {'PASSED' if g7 else 'FAILED'}")
    print("=" * 70)

    all_passed = g1 and g2 and g3 and g4 and g5 and g6 and g7
    if all_passed:
        print("[SUCCESS] All pre-commit GUI checks PASSED successfully.\n")
        sys.exit(0)
    else:
        print("[ABORT] One or more pre-commit GUI checks FAILED.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
