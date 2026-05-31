"""Generate the WordFan icon set from a single vector source.

Design: a folding fan of pages (the "Fan" pun) in white over a warm
sunrise->candy gradient, with small candy-coloured beads at the blade tips and
a gold pivot. The fan is sized to sit inside the maskable safe circle (central
40% radius) so the same artwork works for "any" and "maskable" purposes.

Outputs (under public/icons/, plus /icon.svg as the vector master):
  icon-192.png / icon-512.png            -> manifest purpose "any"
  icon-192-maskable.png / -512-maskable  -> manifest purpose "maskable"
  apple-touch-icon.png (180)             -> iOS home-screen
  favicon-32.png / favicon-16.png        -> browser tab (rounded, transparent)

Rasterised with the Playwright Chromium already used by the smoke suite, so no
extra image dependency is required.
"""
from __future__ import annotations

import math
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]  # apps/wordlover-pwa
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"

# Geometry in a 512 viewBox. Pivot near the bottom; fan opens upward. Shifted up
# so the artwork is vertically centred in the square.
CX = 256.0
PIVOT = (256.0, 358.0)
SPREAD = 68.0            # degrees each side of vertical
R0 = 64.0               # inner radius (near pivot)
R1 = 196.0              # outer radius (rim)
BLADES = 7
BEAD_COLORS = ["#5FD1BE", "#6FB1FF", "#FFD15C", "#FF8FB1", "#B58CFF", "#5FD1BE", "#FFD15C"]


def _pt(angle_deg: float, radius: float) -> tuple[float, float]:
    """Point at `angle_deg` from straight-up (positive = clockwise), `radius` from pivot. y-down."""
    a = math.radians(angle_deg)
    return (PIVOT[0] + radius * math.sin(a), PIVOT[1] - radius * math.cos(a))


def _f(x: float) -> str:
    return f"{x:.2f}"


def build_svg(size: int, *, content_scale: float = 1.0, rounded: bool = False) -> str:
    aL, aR = -SPREAD, SPREAD
    iL, oL = _pt(aL, R0), _pt(aL, R1)
    oR, iR = _pt(aR, R1), _pt(aR, R0)

    fan_body = (
        f"M{_f(iL[0])} {_f(iL[1])} "
        f"L{_f(oL[0])} {_f(oL[1])} "
        f"A{_f(R1)} {_f(R1)} 0 0 1 {_f(oR[0])} {_f(oR[1])} "
        f"L{_f(iR[0])} {_f(iR[1])} "
        f"A{_f(R0)} {_f(R0)} 0 0 0 {_f(iL[0])} {_f(iL[1])} Z"
    )

    # Blade fold lines (interior dividers) + tip beads at each blade centre.
    folds: list[str] = []
    beads: list[str] = []
    for i in range(BLADES + 1):
        a = aL + (aR - aL) * (i / BLADES)
        p_in = _pt(a, R0 + 6)
        p_out = _pt(a, R1 - 8)
        if 0 < i < BLADES:
            folds.append(f"M{_f(p_in[0])} {_f(p_in[1])} L{_f(p_out[0])} {_f(p_out[1])}")
    for i in range(BLADES):
        a = aL + (aR - aL) * ((i + 0.5) / BLADES)
        bx, by = _pt(a, R1 - 26)
        beads.append(
            f'<circle cx="{_f(bx)}" cy="{_f(by)}" r="11" fill="{BEAD_COLORS[i % len(BEAD_COLORS)]}"/>'
        )

    handle = (
        f'<rect x="{_f(PIVOT[0]-13)}" y="{_f(PIVOT[1]-4)}" width="26" height="58" rx="13" '
        f'fill="url(#pivotGrad)"/>'
    )
    pivot = (
        f'<circle cx="{_f(PIVOT[0])}" cy="{_f(PIVOT[1])}" r="26" fill="url(#pivotGrad)"/>'
        f'<circle cx="{_f(PIVOT[0]-7)}" cy="{_f(PIVOT[1]-7)}" r="7" fill="#FFFFFF" opacity="0.55"/>'
    )

    bg = (
        f'<rect x="0" y="0" width="512" height="512" rx="{112 if rounded else 0}" fill="url(#bgGrad)"/>'
        f'<rect x="0" y="0" width="512" height="512" rx="{112 if rounded else 0}" fill="url(#shine)"/>'
    )

    content = (
        f'<g transform="translate(256 256) scale({content_scale}) translate(-256 -256)">'
        f"{handle}"
        f'<path d="{fan_body}" fill="url(#fanGrad)" stroke="#FF6FA0" stroke-width="3" stroke-opacity="0.25"/>'
        f'<path d="{" ".join(folds)}" stroke="#FF8FB7" stroke-width="6" stroke-linecap="round" stroke-opacity="0.45" fill="none"/>'
        f'{"".join(beads)}'
        f"{pivot}"
        f"</g>"
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 512 512" role="img" aria-label="WordFan">'
        "<defs>"
        '<linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#FFB259"/>'
        '<stop offset="0.55" stop-color="#FF7E9D"/>'
        '<stop offset="1" stop-color="#FF5DA2"/>'
        "</linearGradient>"
        '<radialGradient id="shine" cx="0.28" cy="0.22" r="0.9">'
        '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.38"/>'
        '<stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>'
        "</radialGradient>"
        '<linearGradient id="fanGrad" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#FFFFFF"/>'
        '<stop offset="1" stop-color="#FFF1F7"/>'
        "</linearGradient>"
        '<linearGradient id="pivotGrad" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#FFD970"/>'
        '<stop offset="1" stop-color="#FF9F45"/>'
        "</linearGradient>"
        "</defs>"
        f"{bg}{content}"
        "</svg>"
    )


# (filename, pixel size, content_scale, rounded, transparent background)
TARGETS = [
    ("icon-192.png", 192, 1.0, False, False),
    ("icon-512.png", 512, 1.0, False, False),
    ("icon-192-maskable.png", 192, 0.84, False, False),
    ("icon-512-maskable.png", 512, 0.84, False, False),
    ("apple-touch-icon.png", 180, 0.94, False, False),
    ("favicon-32.png", 32, 1.0, True, True),
    ("favicon-16.png", 16, 1.0, True, True),
]


def main() -> int:
    ICONS.mkdir(parents=True, exist_ok=True)

    # Vector master (rounded, used as /icon.svg favicon + manifest "any" svg).
    (PUBLIC / "icon.svg").write_text(build_svg(512, rounded=True), encoding="utf-8")
    (ICONS / "icon.svg").write_text(build_svg(512, rounded=False), encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for name, size, scale, rounded, transparent in TARGETS:
            svg = build_svg(size, content_scale=scale, rounded=rounded)
            html = (
                "<!doctype html><html><head><meta charset='utf-8'>"
                "<style>*{margin:0;padding:0}html,body{background:transparent}"
                f"svg{{display:block;width:{size}px;height:{size}px}}</style></head>"
                f"<body>{svg}</body></html>"
            )
            page.set_viewport_size({"width": size, "height": size})
            page.set_content(html, wait_until="networkidle")
            page.screenshot(path=str(ICONS / name), omit_background=transparent)
            print(f"wrote {name} ({size}x{size})", flush=True)
        browser.close()
    print("icons written to", ICONS, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
