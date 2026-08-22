"""Pixel-level render analysis for review shots.

Per 512px view render:
  - enclosed-background holes (silhouette holes showing studio behind)
  - near-black pixel share inside the model region (inverted-normal suspects)
  - neutral-grey share (placeholder-material suspicion)
  - colorfulness (material-intent signal)

Writes review-shots/commercial-review/pixel-health.json
"""

import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

SRC = "review-shots/commercial-review"
OUT = os.path.join(SRC, "pixel-health.json")


def analyze(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.int16)
    h, w, _ = a.shape

    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    maxc = a.max(axis=2)
    minc = a.min(axis=2)
    sat = np.where(maxc > 0, (maxc - minc) / np.maximum(maxc, 1), 0)
    value = maxc

    # Background = light studio grey (>= ~190) OR ground grey band; model = rest.
    neutral = (maxc - minc) < 12
    bg = neutral & (value >= 185)
    model = ~bg

    # Enclosed background holes: flood fill background from borders.
    bg_mask = bg.astype(np.uint8)
    visited = np.zeros_like(bg_mask, dtype=bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and bg_mask[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))
    holes = bg_mask.astype(bool) & ~visited

    model_px = int(model.sum())
    black_share = float((model & (value < 26)).sum()) / max(1, model_px)
    grey_share = float((model & neutral & (value >= 120) & (value < 185)).sum()) / max(1, model_px)
    colorfulness = float(sat[model].mean()) if model_px else 0.0
    hole_px = int(holes.sum())

    return {
        "view": os.path.basename(path),
        "holePx": hole_px,
        "blackShare": round(black_share, 4),
        "greyShare": round(grey_share, 4),
        "colorfulness": round(colorfulness, 4),
        "modelPx": model_px,
    }


def main():
    files = sorted(
        os.path.join(SRC, f) for f in os.listdir(SRC)
        if f.endswith(".png") and "__" in f
    )
    results = [analyze(f) for f in files]
    with open(OUT, "w") as fh:
        json.dump(results, fh, indent=1)
    holes = [r for r in results if r["holePx"] > 400]
    black = [r for r in results if r["blackShare"] > 0.06]
    print(f"[px] analyzed {len(results)} renders -> {OUT}")
    print(f"[px] hole suspects (>400px): {len(holes)}")
    for r in holes[:12]:
        print("   ", r["view"], r["holePx"])
    print(f"[px] black-patch suspects (>6% of model px): {len(black)}")
    for r in black[:12]:
        print("   ", r["view"], r["blackShare"])


main()
