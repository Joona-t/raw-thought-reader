#!/usr/bin/env python3
"""Contrast check for the named themes in style.css. Exit 1 if any text colour misses WCAG AA.

Reads every :root[data-theme="..."] block, then checks each text colour (--ink, --ink-soft,
--muted, --faint, --accent) against every background it can sit on: --paper, --paper-deep,
--wash and each solid colour in --page-bg (the Korean themes' page gradient).
Run: python3 -I verify_themes.py
"""
import pathlib, re, sys

CSS = (pathlib.Path(__file__).resolve().parent / "style.css").read_text(encoding="utf-8")
TEXT = ("--ink", "--ink-soft", "--muted", "--faint", "--accent")
SURFACES = ("--paper", "--paper-deep", "--wash")
FLOOR = 4.5
# The original Light and Dark themes predate this check: --faint there is decorative-grey on purpose
# (dates, counters) and sits below AA. Checked here only for the themes added from 2026-10-31.
CHECKED = ("kr-seoul", "kr-gingham", "kr-holo", "kr-neon")


def lum(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4 for v in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contrast(a, b):
    A, B = lum(a), lum(b)
    return (max(A, B) + .05) / (min(A, B) + .05)


themes = {m[1]: dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", m[2]))
          for m in re.finditer(r':root\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}', CSS)}
missing = [t for t in CHECKED if t not in themes]
fails, pairs = [], 0
for name in CHECKED:
    if name not in themes: continue
    v = themes[name]
    bgs = [(s, v[s].strip()) for s in SURFACES] + [("--page-bg", h) for h in re.findall(r"#[0-9a-fA-F]{3,6}\b", v.get("--page-bg", ""))]
    for t in TEXT:
        for where, bg in bgs:
            r = contrast(v[t].strip(), bg); pairs += 1
            if r < FLOOR: fails.append(f"{name}: {t} {v[t].strip()} on {where} {bg} = {r:.2f}:1")
if missing: print("missing theme blocks: " + ", ".join(missing))
if fails: print("Contrast below 4.5:1:\n  " + "\n  ".join(fails))
print(f"{len(CHECKED) - len(missing)} themes, {pairs} pairs checked, {len(fails)} below {FLOOR}:1")
sys.exit(1 if fails or missing else 0)
