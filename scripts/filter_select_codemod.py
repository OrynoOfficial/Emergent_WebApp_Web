#!/usr/bin/env python3
"""
Codemod: filter-style <Select> dropdowns → <FilterChipSelect>.

We target the common shape used in admin pages:

    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-40 ..." data-testid="...">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent ...>
        <SelectItem value="all">All ...</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        ...
      </SelectContent>
    </Select>

becomes

    <FilterChipSelect
      icon={CheckCircle}     // chosen from a heuristic table by setter name
      label="Status"
      value={statusFilter}
      onChange={setStatusFilter}
      options={[
        { value: 'all', label: 'All ...' },
        { value: 'active', label: 'Active' },
        ...
      ]}
      data-testid="..."
    />

Limitations
-----------
- Only handles a single <Select> per match.
- Skips multi-line attribute soup where the trigger's className contains
  conditional expressions (`${...}`) — too risky to autofix.
- Per-file we inject the `FilterChipSelect` import and a sensible icon
  import (`CheckCircle`/`Tag`/`Layers`/`Filter`) once.

Run:
    python3 /app/scripts/filter_select_codemod.py            # apply
    python3 /app/scripts/filter_select_codemod.py --dry-run  # preview
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path("/app/frontend/src/pages")

# Setter-name → (icon name, fallback label) heuristic
ICON_TABLE = {
    "setStatusFilter":       ("CheckCircle", "Status"),
    "setRoleFilter":         ("Shield",      "Role"),
    "setTypeFilter":         ("Tag",         "Type"),
    "setCategoryFilter":     ("Layers",      "Category"),
    "setServiceFilter":      ("Building2",   "Services"),
    "setOperatorFilter":     ("Building2",   "Operator"),
    "setPaymentFilter":      ("CreditCard",  "Payment"),
    "setSegmentFilter":      ("TrendingUp",  "Segment"),
    "setRegionFilter":       ("Globe",       "Region"),
}

SELECT_RE = re.compile(
    r"""<Select\s+value=\{(?P<value>[\w.\[\]]+)\}\s+
        onValueChange=\{(?P<setter>\w+)\}\s*>\s*
        <SelectTrigger(?P<trig_attrs>[^>]*)>\s*
        <SelectValue\s+placeholder="(?P<placeholder>[^"]+)"\s*/>\s*
        </SelectTrigger>\s*
        <SelectContent[^>]*>\s*
        (?P<items>(?:<SelectItem[\s\S]*?</SelectItem>\s*)+)
        </SelectContent>\s*
        </Select>""",
    re.VERBOSE,
)

ITEM_RE = re.compile(
    r"""<SelectItem\s+(?:[^>]*?)value=(?P<vq>["'])(?P<val>[^"']+)(?P=vq)
        (?:[^>]*)>\s*
        (?P<label>[^<{][^<]*?)\s*
        </SelectItem>""",
    re.VERBOSE,
)

TESTID_RE = re.compile(r'data-testid=(["\'])(?P<id>[^"\']+)\1')


def parse_items(items_text: str) -> list[dict]:
    out = []
    for m in ITEM_RE.finditer(items_text):
        label = m.group("label").strip()
        if not label:
            continue
        out.append({"value": m.group("val"), "label": label})
    return out


def build_replacement(m: re.Match, file_path: str) -> str | None:
    setter = m.group("setter")
    if setter not in ICON_TABLE:
        return None
    icon, fallback_label = ICON_TABLE[setter]
    trig_attrs = m.group("trig_attrs")
    if "${" in trig_attrs:
        return None
    items = parse_items(m.group("items"))
    if not items:
        return None
    testid_m = TESTID_RE.search(trig_attrs)
    testid_attr = f' data-testid="{testid_m.group("id")}"' if testid_m else ""

    placeholder = m.group("placeholder")
    label = placeholder or fallback_label

    options_js = ",\n        ".join(
        f"{{ value: '{it['value']}', label: '{it['label'].replace(chr(39), chr(92)+chr(39))}' }}"
        for it in items
    )
    return (
        f"<FilterChipSelect\n"
        f"      icon={{{icon}}}\n"
        f"      label=\"{label}\"\n"
        f"      value={{{m.group('value')}}}\n"
        f"      onChange={{{setter}}}\n"
        f"      options={{[\n        {options_js},\n      ]}}{testid_attr}\n"
        f"    />"
    )


def ensure_imports(text: str, icons: set[str]) -> str:
    if "from '@/components/shared/FilterChipSelect'" not in text:
        # Insert after last import
        lines = text.split("\n")
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, "import FilterChipSelect from '@/components/shared/FilterChipSelect';")
        text = "\n".join(lines)
    # Add icon imports to existing lucide-react import line (best-effort)
    missing = []
    for icon in icons:
        if not re.search(rf"\b{icon}\b", text):
            missing.append(icon)
    if missing:
        # Try to extend the first `from 'lucide-react'` import (multi-line aware)
        lr_re = re.compile(r"import\s*\{([\s\S]*?)\}\s*from\s*['\"]lucide-react['\"]")
        m = lr_re.search(text)
        if m:
            existing = m.group(1)
            new_list = existing.rstrip().rstrip(",")
            new_list = new_list + ", " + ", ".join(missing)
            text = text[: m.start(1)] + new_list + text[m.end(1) :]
        else:
            lines = text.split("\n")
            insert_at = 0
            for i, line in enumerate(lines):
                if line.startswith("import "):
                    insert_at = i + 1
            lines.insert(insert_at, f"import {{ {', '.join(missing)} }} from 'lucide-react';")
            text = "\n".join(lines)
    return text


def codemod_file(path: Path, dry_run: bool) -> dict:
    text = path.read_text()
    original = text
    icons_needed: set[str] = set()
    replacements = 0

    def _sub(match: re.Match) -> str:
        nonlocal replacements
        repl = build_replacement(match, str(path))
        if not repl:
            return match.group(0)
        # Extract icon name from "icon={Name}" line
        m2 = re.search(r"icon=\{(\w+)\}", repl)
        if m2:
            icons_needed.add(m2.group(1))
        replacements += 1
        return repl

    text = SELECT_RE.sub(_sub, text)

    if replacements:
        text = ensure_imports(text, icons_needed)
        if not dry_run and text != original:
            path.write_text(text)

    return {"path": path, "replacements": replacements, "icons": icons_needed}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--filter", default="")
    args = ap.parse_args()

    files = [p for p in ROOT.rglob("*.jsx") if "node_modules" not in str(p)]
    if args.filter:
        files = [p for p in files if args.filter in p.name]
    total = 0
    touched = 0
    for f in files:
        r = codemod_file(f, args.dry_run)
        if r["replacements"]:
            total += r["replacements"]
            touched += 1
            print(f"  {f.relative_to(ROOT)}: {r['replacements']} <Select> → FilterChipSelect (icons={sorted(r['icons'])})")
    print(f"\n{'[DRY-RUN] ' if args.dry_run else ''}Touched {touched} files, replaced {total} dropdowns.")


if __name__ == "__main__":
    main()
