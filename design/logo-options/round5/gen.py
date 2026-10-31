import sys
sys.path.insert(0, "../round4")
import os
_cwd = os.getcwd(); os.chdir("../round4")
from gen import tab, line, icon
os.chdir(_cwd)

BLUE, YELLOW, WHITE = "#2563eb", "#fde047", "#fff"
SOURCE = line(4, 104, 66, 104, WHITE, 8) + tab(32, 90, .6, stroke=WHITE, sw=5, dash="8 7", op=.55)

def curve(x1, y1, cx, cy, x2, y2, head_dir):
    return (f'<path d="M{x1} {y1} Q{cx} {cy} {x2} {y2}" fill="none" stroke="{WHITE}" stroke-width="10" stroke-linecap="round"/>'
            f'<path d="M{x2 - 12} {y2 - 12} L{x2} {y2} L{x2 - 12} {y2 + 12}" fill="none" stroke="{WHITE}" stroke-width="10" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')

def tile(x, y, s, fill, op=1):
    return f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{s * .28:.1f}" fill="{fill}" fill-opacity="{op}"/>'

L = {}
L["a-app-grid"] = icon(BLUE, SOURCE
    + tile(72, 14, 20, WHITE, .45) + tile(96, 14, 20, WHITE, .45) + tile(72, 38, 20, WHITE, .45) + tile(96, 38, 20, YELLOW)
    + curve(32, 80, 32, 40, 62, 40, 0))
L["b-dock"] = icon(BLUE, SOURCE
    + '<rect x="66" y="58" width="56" height="12" rx="6" fill="#fff" fill-opacity=".35"/>'
    + tile(74, 18, 36, YELLOW) + '<circle cx="92" cy="36" r="8" fill="none" stroke="#2563eb" stroke-width="5"/>'
    + '<circle cx="92" cy="64" r="3" fill="#fff"/>'
    + curve(32, 80, 32, 36, 62, 36, 0))
L["c-monitor"] = icon(BLUE, SOURCE
    + '<rect x="66" y="14" width="54" height="40" rx="6" fill="#fff"/>'
    + '<rect x="88" y="54" width="10" height="9" fill="#fff"/><rect x="80" y="62" width="26" height="6" rx="3" fill="#fff"/>'
    + tile(74, 22, 16, YELLOW) + tile(96, 22, 16, BLUE, .25)
    + curve(32, 80, 32, 36, 56, 36, 0))
L["d-app-icon"] = icon(BLUE, SOURCE
    + '<rect x="72" y="20" width="42" height="42" rx="12" fill="#1e3a8a" fill-opacity=".45" transform="translate(0 4)"/>'
    + tile(72, 18, 42, YELLOW) + '<path d="M80 26 Q93 22 106 26" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" fill="none"/>'
    + '<path d="M85 40 h16 M93 32 v16" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>'
    + '<circle cx="112" cy="20" r="9" fill="#ef4444" stroke="#2563eb" stroke-width="3"/>'
    + curve(32, 80, 32, 40, 62, 40, 0))

for name, svg in L.items():
    open(f"r5-{name}.svg", "w").write(svg)

def arrow_in(x1, y1, x2, y2, w=11, head=13):
    return (f'<path d="M{x1} {y1} Q{x1} {y2} {x2 - 4} {y2}" fill="none" stroke="{WHITE}" stroke-width="{w}" stroke-linecap="round"/>'
            f'<path d="M{x2 - head} {y2 - head} L{x2} {y2} L{x2 - head} {y2 + head}" fill="none" stroke="{WHITE}" '
            f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')

APP = ('<rect x="68" y="12" width="50" height="50" rx="14" fill="#1e3a8a" fill-opacity=".45" transform="translate(0 5)"/>'
       + tile(68, 12, 50, YELLOW)
       + '<path d="M77 21 Q93 16 109 21" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" fill="none"/>'
       + '<path d="M83 37 h20 M93 27 v20" stroke="#2563eb" stroke-width="7" stroke-linecap="round"/>'
       + '<circle cx="114" cy="16" r="10" fill="#ef4444" stroke="#2563eb" stroke-width="3.5"/>')
L2 = {
    "d2-app-icon-full": icon(BLUE,
        line(4, 112, 124, 112, WHITE, 8)
        + tab(34, 98, .62, stroke=WHITE, sw=5, dash="8 7", op=.6)
        + tab(90, 98, .62, WHITE)
        + APP
        + arrow_in(20, 84, 58, 37)),
}
for name, svg in L2.items():
    open(f"r5-{name}.svg", "w").write(svg)

MONITOR = ('<rect x="62" y="10" width="58" height="44" rx="7" fill="#fff"/>'
           '<rect x="85" y="54" width="12" height="9" fill="#fff"/><rect x="76" y="62" width="30" height="7" rx="3.5" fill="#fff"/>'
           + tile(68, 16, 24, YELLOW)
           + "".join(tile(x, y, 9, BLUE, .22) for y in (17, 30, 43 - 2) for x in (97, 108) if y < 40))
L3 = {
    "c2-monitor-full": icon(BLUE,
        line(4, 112, 124, 112, WHITE, 8)
        + tab(34, 98, .62, stroke=WHITE, sw=5, dash="8 7", op=.6)
        + tab(90, 98, .62, WHITE)
        + MONITOR
        + arrow_in(20, 84, 52, 32)),
}
for name, svg in L3.items():
    open(f"r5-{name}.svg", "w").write(svg)

TAB_PATH = "M-46 18 Q-36 18 -36 8 L-36 -10 Q-36 -18 -28 -18 L28 -18 Q36 -18 36 -10 L36 8 Q36 18 46 18 Z"
FONT = 'font-family="Helvetica, Arial, sans-serif" font-weight="700"'

def ghost_tab(x, y, s):
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<path d="{TAB_PATH}" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".6" stroke-width="{5 / s:.2f}" '
            f'stroke-dasharray="{8 / s:.1f} {7 / s:.1f}" stroke-linejoin="round" stroke-linecap="round"/>'
            '<g opacity=".7"><rect x="-29" y="-7" width="11" height="10" rx="2.5" fill="#fff"/><path d="M-18 -2 L-13 -6 V2 Z" fill="#fff"/>'
            f'<text x="-9" y="2.5" {FONT} font-size="12" fill="#fff">Zaam</text></g></g>')

def kept_tab(x, y, s):
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="{TAB_PATH}" fill="#fff"/>'
            '<rect x="-29" y="-8" width="11" height="13" rx="2" fill="#2563eb"/>'
            '<path d="M-26.5 -4 H-20.5 M-26.5 -1 H-20.5 M-26.5 2 H-22.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
            f'<text x="-12" y="2.5" {FONT} font-size="12" fill="#111">Notes</text></g>')

STRIP = line(4, 112, 124, 112, WHITE, 8) + ghost_tab(34, 98, .62) + kept_tab(90, 98, .62)
L4 = {
    "c3-monitor-text": icon(BLUE, STRIP + MONITOR + arrow_in(20, 79, 52, 32)),
    "d3-app-icon-text": icon(BLUE, STRIP + APP + arrow_in(20, 79, 58, 37)),
}
for name, svg in L4.items():
    open(f"r5-{name}.svg", "w").write(svg)
