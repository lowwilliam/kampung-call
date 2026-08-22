"""Combine 4-view review renders into one labeled contact sheet per asset."""

import os
import sys

from PIL import Image, ImageDraw

SRC = "review-shots/commercial-review"
OUT = "review-shots/commercial-review/sheets"
VIEWS = ["front", "three-quarter", "side", "top"]


def main(src=SRC, out=OUT):
    os.makedirs(out, exist_ok=True)
    names = sorted({
        f.rsplit("__", 1)[0]
        for f in os.listdir(src)
        if f.endswith(".png") and "__" in f
    })
    cell = 512
    label_h = 40
    made = 0
    for name in names:
        sheet = Image.new("RGB", (cell * 2, cell * 2 + label_h), (24, 24, 26))
        draw = ImageDraw.Draw(sheet)
        draw.text((10, 8), name, fill=(255, 255, 255))
        for i, view in enumerate(VIEWS):
            path = os.path.join(src, f"{name}__{view}.png")
            if not os.path.exists(path):
                continue
            img = Image.open(path).convert("RGB").resize((cell, cell))
            x = (i % 2) * cell
            y = label_h + (i // 2) * cell
            sheet.paste(img, (x, y))
            draw.text((x + 8, y + 6), view, fill=(255, 220, 120))
        sheet.save(os.path.join(out, f"{name}-sheet.png"))
        made += 1
    print(f"[sheets] wrote {made} sheets to {out}")


if __name__ == "__main__":
    main(*sys.argv[1:2])
