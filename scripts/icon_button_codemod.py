#!/usr/bin/env python3
"""
Codemod: convert text+icon Button toolbar actions to <IconButton> across
admin/management pages.

Patterns rewritten (4 of them — these cover ~95% of toolbar buttons):

  1. Refresh
     <Button variant="..." size="sm" onClick={X}>
       <RefreshCw className="..." /> Refresh
     </Button>
       →
     <IconButton icon={RefreshCw} label="Refresh" variant="outline" size="sm" onClick={X} />

  2. Export
     <Button variant="..." size="sm" onClick={X}>
       <Download className="..." /> Export
     </Button>
       →
     <IconButton icon={Download} label="Export" variant="outline" size="sm" onClick={X} />

  3. Filter
     <Button variant="..." size="sm" onClick={X}>
       <Filter className="..." /> Filters?
     </Button>
       →
     <IconButton icon={Filter} label="Filters" variant="outline" size="sm" onClick={X} />

  4. Add X
     <Button className=".*bg-(...)" size="sm" onClick={X}>
       <Plus className="..." /> Add Foo
     </Button>
       →
     <IconButton icon={Plus} label="Add Foo" variant="solid" size="sm" onClick={X} />

For every file touched the script also injects the IconButton import next to
the existing react-imports if missing.

Run:
    python3 /app/scripts/icon_button_codemod.py            # apply
    python3 /app/scripts/icon_button_codemod.py --dry-run  # preview
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path("/app/frontend/src/pages")

PATTERNS = [
    # 1. Refresh
    (
        re.compile(
            r"""<Button(?P<attrs>[^>]*?)>\s*
                <RefreshCw\s+className=["'][^"']*["']\s*/>\s*
                Refresh\s*
                </Button>""",
            re.VERBOSE | re.DOTALL,
        ),
        '<IconButton icon={RefreshCw} label="Refresh" variant="outline"\\g<attrs> />',
    ),
    # 2. Export
    (
        re.compile(
            r"""<Button(?P<attrs>[^>]*?)>\s*
                <Download\s+className=["'][^"']*["']\s*/>\s*
                Export\s*
                </Button>""",
            re.VERBOSE | re.DOTALL,
        ),
        '<IconButton icon={Download} label="Export" variant="outline"\\g<attrs> />',
    ),
    # 3. Filter / Filters
    (
        re.compile(
            r"""<Button(?P<attrs>[^>]*?)>\s*
                <Filter\s+className=["'][^"']*["']\s*/>\s*
                Filters?\s*
                </Button>""",
            re.VERBOSE | re.DOTALL,
        ),
        '<IconButton icon={Filter} label="Filters" variant="outline"\\g<attrs> />',
    ),
    # 4. Add X (Plus icon)
    (
        re.compile(
            r"""<Button(?P<attrs>[^>]*?)>\s*
                <Plus\s+className=["'][^"']*["']\s*/>\s*
                (?P<label>Add\s+[A-Za-z][\w\s-]*?)\s*
                </Button>""",
            re.VERBOSE | re.DOTALL,
        ),
        '<IconButton icon={Plus} label="\\g<label>" variant="solid"\\g<attrs> />',
    ),
]


IMPORT_LINE = "import IconButton from '@/components/shared/IconButton';\n"


def ensure_import(text: str) -> tuple[str, bool]:
    """Insert the IconButton import after the last existing import block.

    Returns (new_text, did_change).
    """
    if "from '@/components/shared/IconButton'" in text or "from '@/components/shared/IconButton.jsx'" in text:
        return text, False
    # Find last consecutive import line
    lines = text.split("\n")
    insert_at = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, IMPORT_LINE.rstrip("\n"))
    return "\n".join(lines), True


def codemod_file(path: Path, dry_run: bool) -> dict:
    text = path.read_text()
    original = text
    counts = {"refresh": 0, "export": 0, "filter": 0, "add": 0}
    keys = ["refresh", "export", "filter", "add"]
    for (pat, repl), key in zip(PATTERNS, keys):
        new_text, n = pat.subn(repl, text)
        counts[key] = n
        text = new_text
    total = sum(counts.values())
    if total == 0:
        return {"path": path, "total": 0, "counts": counts, "changed": False}
    text, _ = ensure_import(text)
    if not dry_run and text != original:
        path.write_text(text)
    return {"path": path, "total": total, "counts": counts, "changed": text != original}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--filter", default="", help="Only files whose name matches this substring")
    args = ap.parse_args()

    files = [p for p in ROOT.rglob("*.jsx") if "node_modules" not in str(p)]
    if args.filter:
        files = [p for p in files if args.filter in p.name]
    print(f"Scanning {len(files)} JSX files…")
    total_buttons = 0
    touched = 0
    for f in files:
        r = codemod_file(f, args.dry_run)
        if r["total"]:
            total_buttons += r["total"]
            touched += 1
            print(
                f"  {f.relative_to(ROOT)}: "
                f"refresh={r['counts']['refresh']} export={r['counts']['export']} "
                f"filter={r['counts']['filter']} add={r['counts']['add']}"
            )
    print(f"\n{'[DRY-RUN] ' if args.dry_run else ''}Touched {touched} files, replaced {total_buttons} buttons.")


if __name__ == "__main__":
    main()
