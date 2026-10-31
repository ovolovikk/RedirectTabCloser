TAB = "M-46 18 Q-36 18 -36 8 L-36 -10 Q-36 -18 -28 -18 L28 -18 Q36 -18 36 -10 L36 8 Q36 18 46 18 Z"
H = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'

def bg(fill, grad=None):
    if grad:
        a, b = grad
        return (f'<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{a}"/>'
                f'<stop offset="1" stop-color="{b}"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/>')
    return f'<rect width="128" height="128" rx="28" fill="{fill}"/>'

def tab(x, y, s, fill="none", stroke="none", sw=0, dash=None, op=1, rot=0):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path d="{TAB}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{sw / s:.2f}" stroke-opacity="{op}" stroke-linejoin="round" stroke-linecap="round"{d}/></g>')

def arrow(x1, y1, x2, y2, head, color, w=12):
    return (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'
            f'<path d="M{x2 - head} {y2} H{x2} V{y2 + head}" fill="none" stroke="{color}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')

def line(x1, y1, x2, y2, color, w):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>'

L = {}
S, CY = .68, 88
GX, KX = 38, 90
STRIP_Y = CY + 18 * S + 1
def base(fg, ghost_op=.75, kept_fill=None, strip=True, dash="8 7"):
    out = line(6, STRIP_Y, 122, STRIP_Y, fg, 7) if strip else ""
    out += tab(KX, CY, S, kept_fill or fg)
    out += tab(GX, CY, S, stroke=fg, sw=5, dash=dash, op=ghost_op)
    return out
def arr(color, w=13):
    return arrow(GX, CY, 102, CY - 64, 26, color, w)

L["01-ember"]      = bg(None, ("#e11d48", "#fb923c")) + base("#fff") + arr("#fff")
L["02-night"]      = bg("#111") + base("#fafafa", .55) + arr("#facc15")
L["03-paper"]      = (bg("#fff") + '<rect x="1" y="1" width="126" height="126" rx="27" fill="none" stroke="#e5e7eb" stroke-width="2"/>'
                      + base("#111", .4) + arr("#ef4444"))
L["04-crossed"]    = (bg(None, ("#f97316", "#facc15")) + base("#fff", .6)
                      + line(24, 66, 60, 102, "#fff", 11).replace('stroke="#fff"', 'stroke="#fff" stroke-opacity=".5"') + arr("#fff"))
L["05-ocean"]      = bg(None, ("#0369a1", "#22d3ee")) + base("#fff") + arr("#fff")
L["06-three-tabs"] = (bg("#ef4444") + line(6, 100, 122, 100, "#fff", 7) + tab(22, 90, .46, "#fff") + tab(106, 90, .46, "#fff")
                      + tab(64, 90, .46, stroke="#fff", sw=4.5, dash="7 6", op=.75) + arrow(64, 90, 110, 30, 24, "#fff", 12))
L["07-mint"]       = bg("#064e3b") + base("#6ee7b7", .7) + arr("#fff")
L["08-outline"]    = (bg("#0f766e") + line(6, STRIP_Y, 122, STRIP_Y, "#fff", 7)
                      + tab(KX, CY, S, stroke="#fff", sw=6) + tab(GX, CY, S, stroke="#fff", sw=5, dash="8 7", op=.7) + arr("#fde047"))
L["09-graphite"]   = bg("#1f2937") + base("#e5e7eb", .5) + arr("#fb923c")
L["10-window"]     = (bg("#a3e635") + '<rect x="10" y="66" width="108" height="50" rx="10" fill="#0a0a0a"/>'
                      + '<rect x="18" y="80" width="92" height="28" rx="5" fill="#a3e635" fill-opacity=".3"/>'
                      + tab(84, 58, .5, "#0a0a0a") + tab(38, 58, .5, stroke="#0a0a0a", sw=4.5, dash="7 6", op=.8)
                      + arrow(38, 58, 88, 8, 22, "#0a0a0a", 12))
L["11-sunflower"]  = bg("#facc15") + base("#111", .5) + arr("#111")
L["12-tilt"]       = (bg(None, ("#f43f5e", "#fb7185")) + '<g transform="rotate(-10 64 90)">' + base("#fff", .7) + '</g>'
                      + arrow(40, 92, 102, 26, 26, "#fff", 13))
L["13-sky-no-strip"] = bg(None, ("#2563eb", "#38bdf8")) + base("#fff", strip=False) + arr("#fff")
L["14-gap"]        = (bg(None, ("#e11d48", "#fb923c")) + line(66, STRIP_Y, 122, STRIP_Y, "#fff", 7) + line(6, STRIP_Y, 8, STRIP_Y, "#fff", 7)
                      + tab(KX, CY, S, "#fff") + tab(GX, CY, S, stroke="#fff", sw=5, dash="8 7", op=.75) + arr("#fff"))

for name, svg in L.items():
    open(f"r3-{name}.svg", "w").write(f"{H}\n{svg}\n</svg>\n")
