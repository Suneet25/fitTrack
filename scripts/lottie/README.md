# Lottie animations

Source for the hand-made animations in `public/lottie/`. Each script writes its JSON there.

```bash
cd scripts/lottie
python3 watch.py   # → public/lottie/activity-watch.json
python3 diet.py    # → public/lottie/diet-bowl.json
```

`lib.py` has the shared helpers (shapes, keyframes, easing). Colours match the
theme in `src/app/globals.css`. Layers added first draw on top.
