#!/usr/bin/env python3
"""Objective pixel-signal analysis for asset review sheets.

NOT a visual QA verdict. Produces measurable signals only:
- subject coverage per quadrant view
- near-black share of subject pixels (possible black-patch/inverted-normal indicator)
- hue-family shares of subject pixels (material-intent signal)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SHEET_DIR = Path("/Users/william/Documents/Massanger/review-shots/commercial-review/sheets")
ASSETS = [
    "national-theatre", "national-university-v2", "oriental-pied-hornbill-v1",
    "overheadbridge-v2", "palm-v2", "pearl-bank-apartments", "peranakan-house-v2",
    "pointblock-call-v2", "postbox-v2", "raintree-v2", "red-junglefowl-v1",
    "router-kit-v2", "satellite-station-v2", "service-van-v2", "shophouse-v2",
]
VIEWS = ["front", "three-quarter", "side", "top"]


def analyze_quadrant(arr):
    h, w, _ = arr.shape
    # backdrop = median of four corner patches (16px squares)
    corners = np.concatenate([
        arr[:16, :16].reshape(-1, 3), arr[:16, -16:].reshape(-1, 3),
        arr[-16:, :16].reshape(-1, 3), arr[-16:, -16:].reshape(-1, 3),
    ])
    backdrop = np.median(corners, axis=0)
    dist = np.linalg.norm(arr.astype(int) - backdrop.astype(int), axis=2)
    subject = dist > 45
    frac_subject = float(subject.mean())
    out = {"subject_frac": round(frac_subject, 3)}
    if subject.sum() < 50:
        out["near_black_share"] = None
        return out
    px = arr[subject].astype(float) / 255.0
    mx = px.max(axis=1)
    mn = px.min(axis=1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # hue
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    delta = mx - mn + 1e-9
    hue = np.zeros(len(px))
    m = mx == r
    hue[m] = (60 * ((g - b) / delta) % 360)[m]
    m = mx == g
    hue[m] = (60 * ((b - r) / delta) + 120)[m]
    m = mx == b
    hue[m] = (60 * ((r - g) / delta) + 240)[m]
    near_black = v < 0.13  # very dark subject pixels (patch/shadow candidates)
    out["near_black_share"] = round(float(near_black.mean()), 3)
    colored = (s > 0.22) & (v > 0.18)
    fam = {}
    fam["neutral_gray"] = float((~colored).mean())
    labels = [("red", (hue < 14) | (hue >= 345)), ("orange_yellow", (hue >= 14) & (hue < 70)),
              ("green", (hue >= 70) & (hue < 170)), ("cyan_blue", (hue >= 170) & (hue < 262)),
              ("purple_magenta", (hue >= 262) & (hue < 345))]
    for name, mask in labels:
        fam[name] = float((colored & mask).sum()) / len(px)
    out["hue_shares"] = {k: round(x, 3) for k, x in fam.items() if x >= 0.02}
    return out


def main():
    report = {}
    for name in ASSETS:
        path = SHEET_DIR / f"{name}-sheet.png"
        img = Image.open(path).convert("RGB")
        arr = np.asarray(img)
        H, W, _ = arr.shape
        qs = {
            "front": arr[: H // 2, : W // 2],
            "three-quarter": arr[: H // 2, W // 2 :],
            "side": arr[H // 2 :, : W // 2],
            "top": arr[H // 2 :, W // 2 :],
        }
        report[name] = {view: analyze_quadrant(q) for view, q in qs.items()}
    json.dump(report, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
