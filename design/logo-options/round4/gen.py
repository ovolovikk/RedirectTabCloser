TAB = "M-46 18 Q-36 18 -36 8 L-36 -10 Q-36 -18 -28 -18 L28 -18 Q36 -18 36 -10 L36 8 Q36 18 46 18 Z"
H = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
CLIP = '<defs><clipPath id="c"><rect width="128" height="128" rx="28"/></clipPath></defs>'

def tab(x, y, s, fill="none", stroke="none", sw=0, dash=None, op=1, fop=1, rot=0):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path d="{TAB}" fill="{fill}" fill-opacity="{fop}" '
            f'stroke="{stroke}" stroke-width="{sw / s:.2f}" stroke-opacity="{op}" stroke-linejoin="round" stroke-linecap="round"{d}/></g>')

def arrow(x1, y1, x2, y2, head, color, w=12):
    return (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'
            f'<path d="M{x2 - head} {y2} H{x2} V{y2 + head}" fill="none" stroke="{color}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')

def line(x1, y1, x2, y2, color, w, op=1):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="{w}" stroke-opacity="{op}" stroke-linecap="round"/>'

def star(cx, cy, r, color):
    k = r * .28
    return (f'<path d="M{cx} {cy - r} Q{cx + k} {cy - k} {cx + r} {cy} Q{cx + k} {cy + k} {cx} {cy + r} '
            f'Q{cx - k} {cy + k} {cx - r} {cy} Q{cx - k} {cy - k} {cx} {cy - r} Z" fill="{color}"/>')

def icon(bg, body):
    return f'{H}\n{CLIP}<g clip-path="url(#c)"><rect width="128" height="128" fill="{bg}"/>{body}</g>\n</svg>\n'

L = {}

L["1-external-tab"] = icon("#1d4ed8",
    line(4, 96, 124, 96, "#fff", 8) + tab(58, 78, 1.0, stroke="#fff", sw=9)
    + '<circle cx="92" cy="62" r="15" fill="#1d4ed8"/>' + arrow(56, 82, 104, 34, 28, "#fff", 13))

L["2-clean-slot"] = icon("#15803d",
    line(4, 98, 124, 98, "#fff", 8) + tab(24, 88, .44, "#fff") + tab(104, 88, .44, "#fff")
    + tab(64, 88, .44, stroke="#fff", sw=4, dash="6 6", op=.55)
    + star(64, 50, 24, "#fde047") + star(94, 24, 10, "#fde047"))

L["3-evaporate"] = icon("#0f766e",
    line(4, 104, 124, 104, "#fff", 8) + tab(64, 90, .9, "#fff", fop=.95)
    + '<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round">'
      '<path d="M40 62 Q30 50 40 40 Q50 30 40 18" stroke-opacity=".85"/>'
      '<path d="M64 60 Q54 46 64 34 Q74 22 64 10" stroke-opacity=".6"/>'
      '<path d="M88 62 Q78 50 88 40 Q98 30 88 20" stroke-opacity=".35"/></g>')

L["4-zip-out"] = icon("#ea580c",
    line(4, 104, 124, 104, "#fff", 8) + tab(40, 90, .62, stroke="#fff", sw=5, dash="8 7", op=.6)
    + '<g stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-opacity=".75">'
      '<path d="M40 60 L58 52"/><path d="M36 76 L58 66"/><path d="M58 80 L72 74"/></g>'
    + tab(90, 38, .62, "#fff", rot=-20))

L["5-handoff"] = icon("#2563eb",
    line(4, 104, 66, 104, "#fff", 8) + tab(34, 90, .6, stroke="#fff", sw=5, dash="8 7", op=.55)
    + '<rect x="74" y="20" width="38" height="38" rx="11" fill="#fde047"/>'
    + '<path d="M34 80 Q34 40 66 38" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>'
    + '<path d="M54 26 L68 38 L54 50" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')

L["6-done"] = icon("#111827",
    line(4, 100, 124, 100, "#fff", 8, .9) + tab(64, 86, .9, stroke="#fff", sw=6, dash="10 8", op=.45)
    + '<path d="M38 52 L58 72 L96 30" fill="none" stroke="#4ade80" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>')

L["7-pop"] = icon("#e11d48",
    line(4, 104, 124, 104, "#fff", 8) + tab(64, 88, .9, stroke="#fff", sw=7, dash="14 12", op=.9)
    + '<g stroke="#fff" stroke-width="8" stroke-linecap="round">'
      '<path d="M64 52 V30"/><path d="M36 58 L24 44"/><path d="M92 58 L104 44"/><path d="M20 78 H8"/><path d="M108 78 H120"/></g>')

for name, svg in L.items():
    open(f"r4-{name}.svg", "w").write(svg)
