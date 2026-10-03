"""Tiny Lottie (bodymovin 5.7) builder for hand-authored animations."""
import json

def rgb(h):
    h = h.lstrip('#'); return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)] + [1]

EASE = {"i": {"x": [0.42], "y": [1]}, "o": {"x": [0.58], "y": [0]}}
EASE_IN = {"i": {"x": [0.7], "y": [1]}, "o": {"x": [0.4], "y": [0]}}
OUT_BACK = {"i": {"x": [0.3], "y": [1.4]}, "o": {"x": [0.3], "y": [0]}}
LINEAR = {"i": {"x": [1], "y": [1]}, "o": {"x": [0], "y": [0]}}

def S(v): return {"a": 0, "k": v}

def A(frames, ease=EASE):
    """frames: [(t, value)] or [(t, value, ease)] — ease applies to the segment starting at t."""
    k = []
    for f in frames[:-1]:
        t, v = f[0], f[1]; e = f[2] if len(f) > 2 else ease
        k.append({"t": t, "s": v if isinstance(v, list) else [v], **e})
    t, v = frames[-1][0], frames[-1][1]
    k.append({"t": t, "s": v if isinstance(v, list) else [v]})
    return {"a": 1, "k": k}

def tr(p=(0, 0), r=0, s=(100, 100), o=100, a=(0, 0)):
    def val(x): return x if isinstance(x, dict) else S(list(x) if isinstance(x, tuple) else x)
    return {"ty": "tr", "p": val(p), "a": val(a), "s": val(s), "r": val(r), "o": val(o), "sk": S(0), "sa": S(0)}

def fill(c, o=100): return {"ty": "fl", "c": S(c), "o": S(o), "r": 1}
def stroke(c, w, o=100, cap=2): return {"ty": "st", "c": S(c), "o": S(o), "w": S(w), "lc": cap, "lj": 2}
def rect(w, h, r=0, p=(0, 0)): return {"ty": "rc", "d": 1, "s": S([w, h]), "p": S(list(p)), "r": S(r)}
def ellipse(w, h, p=(0, 0)): return {"ty": "el", "d": 1, "s": S([w, h]), "p": S(list(p))}
def trim(s=S(0), e=S(100), o=S(0)): return {"ty": "tm", "s": s, "e": e, "o": o, "m": 1}

def path(v, i=None, o=None, closed=True):
    n = len(v)
    return {"ty": "sh", "ks": S({"i": i or [[0, 0]] * n, "o": o or [[0, 0]] * n, "v": v, "c": closed})}

def group(*items, t=None):
    return {"ty": "gr", "it": list(items) + [t or tr()]}

def ks(p, s=S([100, 100, 100]), r=S(0), o=S(100), a=S([0, 0, 0])):
    return {"o": o, "r": r, "p": p, "a": a, "s": s}

class Comp:
    def __init__(self, name, w=400, h=400, fr=60, op=180):
        self.name, self.w, self.h, self.fr, self.op = name, w, h, fr, op
        self.layers = []
    def add(self, name, shapes, ksv, ip=0, op=None):
        """Layers added first are drawn on top."""
        self.layers.append({"ddd": 0, "ind": len(self.layers) + 1, "ty": 4, "nm": name, "sr": 1, "ks": ksv,
                            "ao": 0, "shapes": shapes, "ip": ip, "op": self.op if op is None else op, "st": 0, "bm": 0})
    def save(self, path):
        data = {"v": "5.7.4", "fr": self.fr, "ip": 0, "op": self.op, "w": self.w, "h": self.h,
                "nm": self.name, "ddd": 0, "assets": [], "layers": self.layers}
        s = json.dumps(data, separators=(",", ":"))
        open(path, "w").write(s)
        return len(s)

# Heart, ~24px wide, centred on 0,0.
HEART = path(
    [[0, 10], [-11, -1], [-6, -10], [0, -6], [6, -10], [11, -1]],
    i=[[5, -4], [0, 4], [-4, 0], [-1, -3], [-3, 0], [0, -5]],
    o=[[-5, -4], [0, -5], [3, 0], [1, -3], [4, 0], [0, 4]],
)
