from lib import *
GREEN, GREEN_D, LEAF, RED, ORANGE = rgb('#10b866'), rgb('#059652'), rgb('#6ce7a6'), rgb('#ff4d5e'), rgb('#ff6310')
YOLK, WHITE, PIT, AVO, BOWL, BOWL_D = rgb('#ffc53d'), rgb('#ffffff'), rgb('#8a5a2b'), rgb('#a6d96a'), rgb('#ff8437'), rgb('#f04806')
STEEL, STEEL_D = rgb('#c9d1db'), rgb('#9aa4b4')
c = Comp("FitTrack diet", op=200)
BOWL_TOP = 250  # y of the bowl rim

def drop(x, y, t, settle_rot=0):
    """Falls from above, squashes on landing, bounces once, then settles."""
    p = A([(t, [x, -60, 0], EASE_IN), (t + 22, [x, y, 0], EASE), (t + 30, [x, y - 16, 0], EASE_IN), (t + 37, [x, y, 0])])
    s = A([(t, [90, 110, 100]), (t + 22, [118, 84, 100], OUT_BACK), (t + 32, [100, 100, 100])])
    r = A([(t, settle_rot - 40), (t + 30, settle_rot)])
    return p, s, r

FADE_OUT = lambda: A([(0, 100), (178, 100), (192, 0)])

# Fork: swoops in, spears the tomato, carries it off.
fork = [
    group(rect(8, 28, 3, p=(-12, -40)), rect(8, 28, 3, p=(0, -40)), rect(8, 28, 3, p=(12, -40)), fill(STEEL)),
    group(rect(40, 14, 6, p=(0, -22)), fill(STEEL)),
    group(rect(12, 120, 6, p=(0, 40)), fill(STEEL_D)),
]
fork_p = A([(108, [380, -60, 0]), (130, [232, 205, 0], EASE), (138, [232, 215, 0], EASE_IN), (162, [330, -140, 0])])
c.add("fork", fork, ks(fork_p, r=A([(108, 210), (130, 200), (162, 215)]), a=S([0, -54, 0])), ip=100, op=200)

# Steam rising once the bowl is full.
for i, x in enumerate([160, 200, 240]):
    t = 70 + i * 8
    wave = path([[0, 0], [0, -30], [0, -60]], i=[[0, 0], [-12, 8], [0, 0]], o=[[0, 0], [12, -8], [0, 0]], closed=False)
    c.add(f"steam{i}", [group(wave, trim(s=A([(t, 0), (t + 40, 100)]), e=A([(t - 10, 0), (t + 25, 100)])), stroke(rgb('#9aa4b4'), 5))],
          ks(S([x, BOWL_TOP - 70, 0]), o=S(60)), ip=t - 10, op=t + 45)

# Ingredients, dropping in one after another (first listed draws on top).
items = [
    ("tomato", [group(path([[0, -14], [5, -24], [0, -20], [-5, -24]]), fill(GREEN_D)), group(ellipse(38, 36), fill(RED)),
                group(ellipse(10, 6, p=(-8, -6)), fill(WHITE, 45))], 232, BOWL_TOP - 26, 30, 0),
    ("egg", [group(ellipse(18, 18), fill(YOLK)), group(ellipse(40, 34), fill(WHITE))], 172, BOWL_TOP - 22, 22, -10),
    ("avocado", [group(ellipse(16, 18, p=(0, 4)), fill(PIT)), group(ellipse(34, 42), fill(AVO)), group(ellipse(42, 50), fill(GREEN_D))],
     268, BOWL_TOP - 18, 14, 18),
    ("leaf2", [group(path([[-26, 0], [26, 0]], closed=False), stroke(GREEN_D, 3)), group(ellipse(56, 26), fill(GREEN))], 140, BOWL_TOP - 12, 6, 25),
    ("leaf1", [group(path([[-28, 0], [28, 0]], closed=False), stroke(GREEN, 3)), group(ellipse(60, 28), fill(LEAF))], 205, BOWL_TOP - 8, 0, -18),
]
for name, shapes, x, y, t, rot in items:
    p, s, r = drop(x, y, t, rot)
    if name == "tomato":  # rides away on the fork
        p = A([(t, [x, -60, 0], EASE_IN), (t + 22, [x, y, 0]), (t + 30, [x, y - 16, 0], EASE_IN), (t + 37, [x, y, 0]),
               (138, [x, y, 0], EASE_IN), (162, [x + 98, y - 355, 0])])
    c.add(name, shapes, ks(p, s=s, r=r, o=FADE_OUT()))

# Bowl: rim highlight + body.
bowl = path([[-110, 0], [0, 86], [110, 0]], i=[[0, 0], [-62, 0], [0, 48]], o=[[0, 48], [62, 0], [0, 0]])
c.add("bowl", [
    group(rect(234, 16, 8, p=(0, 0)), fill(BOWL_D)),
    group(path([[-60, 34], [60, 34]], closed=False), stroke(WHITE, 6, o=35)),
    group(bowl, fill(BOWL)),
    group(ellipse(160, 18, p=(0, 98)), fill(rgb('#000000'), 18)),
], ks(S([200, BOWL_TOP, 0]), s=A([(20, [100, 100, 100]), (26, [104, 96, 100]), (34, [100, 100, 100])])))
print("diet bytes:", c.save("../../public/lottie/diet-bowl.json"))
