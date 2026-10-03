from lib import *
GREEN, ORANGE, RED, WHITE = rgb('#10b866'), rgb('#ff6310'), rgb('#ff4d5e'), rgb('#ffffff')
BODY, BEZEL, STRAP, SCREEN = rgb('#1c232c'), rgb('#3a4552'), rgb('#2b333d'), rgb('#06090d')
c = Comp("FitTrack watch", op=180)

def hold_keys(segments):
    """segments: [(t_start, v_start, t_end, v_end)] animated; value holds between segments."""
    k = []
    for ts, vs, te, ve in segments:
        if ts == te:  # an instant reset that holds until the next segment
            k.append({"t": ts, "s": [vs], "h": 1})
            continue
        k.append({"t": ts, "s": [vs], **EASE})
        k.append({"t": te, "s": [ve], "h": 1})
    return {"a": 1, "k": k}

# Sync-complete badge (top right), pops when the rings close.
badge = [
    group(path([[-9, 0], [-3, 6], [9, -6]], closed=False), stroke(WHITE, 4.5), t=tr()),
    group(ellipse(40, 40), fill(GREEN)),
]
c.add("badge", badge, ks(S([292, 98, 0]),
    s=A([(78, [0, 0, 100], OUT_BACK), (92, [100, 100, 100]), (165, [100, 100, 100]), (178, [0, 0, 100])])))

# Sparkles around the watch.
for i, (x, y, col, t) in enumerate([(110, 120, ORANGE, 82), (300, 300, GREEN, 88), (95, 280, GREEN, 94), (310, 180, ORANGE, 100)]):
    c.add(f"spark{i}", [group(ellipse(12, 12), fill(col))], ks(S([x, y, 0]),
        s=A([(t, [0, 0, 100]), (t + 10, [130, 130, 100]), (t + 26, [0, 0, 100])])))

# Sync pings radiating from the watch.
for i, t in enumerate([96, 110]):
    c.add(f"ping{i}", [group(rect(190, 220, 54), stroke(GREEN, 4))], ks(S([200, 200, 0]),
        s=A([(t, [92, 92, 100]), (t + 45, [128, 128, 100])]), o=A([(t, 70), (t + 45, 0)])), ip=t, op=t + 45)

# The watch itself: one layer so it bobs and tilts as a whole (first shapes draw on top).
ecg = path([[-52, 0], [-30, 0], [-24, -6], [-18, 0], [-12, 0], [-6, -15], [0, 10], [6, -5], [12, 0],
            [30, 0], [36, -5], [42, 0], [52, 0]], closed=False)
beat = A([(0, [100, 100]), (6, [128, 128]), (14, [100, 100]), (45, [100, 100]), (51, [128, 128]), (59, [100, 100]),
          (90, [100, 100]), (96, [128, 128]), (104, [100, 100]), (135, [100, 100]), (141, [128, 128]), (149, [100, 100]), (180, [100, 100])])
watch = [
    # Heart in the middle of the rings
    group(HEART, fill(RED), t=tr(p=(0, -24), s=beat)),
    # Activity rings: faint track + animated progress
    group(ellipse(96, 96), trim(e=A([(8, 0), (78, 86)])), stroke(GREEN, 11), t=tr(p=(0, -24))),
    group(ellipse(96, 96), stroke(GREEN, 11, o=22), t=tr(p=(0, -24))),
    group(ellipse(68, 68), trim(e=A([(18, 0), (84, 72)])), stroke(ORANGE, 11), t=tr(p=(0, -24))),
    group(ellipse(68, 68), stroke(ORANGE, 11, o=22), t=tr(p=(0, -24))),
    # Heart-rate line sweeping across the bottom of the screen
    group(ecg, trim(s=hold_keys([(15, 0, 75, 100), (90, 0, 90, 0), (105, 0, 165, 100)]),
                    e=hold_keys([(0, 0, 55, 100), (90, 0, 145, 100)])),
          stroke(GREEN, 3.5), t=tr(p=(0, 56))),
    # Screen, bezel, crown, body
    group(rect(140, 172, 32), fill(SCREEN)),
    group(rect(14, 36, 5, p=(92, -30)), fill(BEZEL)),
    group(rect(170, 204, 46), stroke(BEZEL, 6), fill(BODY)),
    # Strap with holes
    group(ellipse(10, 10, p=(0, 150)), fill(BODY)),
    group(ellipse(10, 10, p=(0, 175)), fill(BODY)),
    group(rect(112, 140, 26, p=(0, 150)), fill(STRAP)),
    group(rect(112, 140, 26, p=(0, -150)), fill(STRAP)),
]
c.add("watch", watch, ks(A([(0, [200, 204, 0]), (90, [200, 194, 0]), (180, [200, 204, 0])]),
    r=A([(0, -7), (90, -3), (180, -7)])))
print("watch bytes:", c.save("../../public/lottie/activity-watch.json"))
