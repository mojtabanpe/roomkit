#!/usr/bin/env python3
"""Cut the shipped logo assets out of the master lockup.

The master (`brand/roomkit-logo.png`) is a stacked lockup: the mark sits above
the روم‌کیت wordmark, separated by a band of fully transparent rows. We split it
so the same artwork can also be laid out horizontally in tight bars.

Run from the repo root:  python3 tools/build-logo-assets.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "roomkit-logo.png"
OUT = ROOT / "apps" / "web" / "public"

# Display sizes top out around 34px, so 256px of mark gives ~7x for retina
# without shipping the full 221 KB master on every page load.
MARK_HEIGHT = 256
WORD_HEIGHT = 128
FAVICON = 64
# Alpha at or below this counts as an empty row when finding the split.
ALPHA_FLOOR = 8


def content_bands(image: Image.Image) -> list[tuple[int, int]]:
    """Vertical runs of rows that contain any visible pixel."""
    width, height = image.size
    alpha = image.split()[-1]
    bands: list[tuple[int, int]] = []
    start = None
    for y in range(height):
        row_has_ink = max(alpha.crop((0, y, width, y + 1)).getdata()) > ALPHA_FLOOR
        if row_has_ink and start is None:
            start = y
        elif not row_has_ink and start is not None:
            bands.append((start, y))
            start = None
    if start is not None:
        bands.append((start, height))
    return bands


def scaled_to_height(image: Image.Image, height: int) -> Image.Image:
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.LANCZOS)


def main() -> None:
    master = Image.open(SRC).convert("RGBA")
    bands = content_bands(master)
    if len(bands) != 2:
        raise SystemExit(
            f"expected a mark band and a wordmark band, found {len(bands)}: {bands}"
        )

    (mark_top, mark_bottom), (word_top, word_bottom) = bands

    mark = master.crop((0, mark_top, master.width, mark_bottom))
    mark = mark.crop(mark.getbbox())
    scaled_to_height(mark, MARK_HEIGHT).save(OUT / "logo-mark.png", optimize=True)

    word = master.crop((0, word_top, master.width, word_bottom))
    word = word.crop(word.getbbox())
    scaled_to_height(word, WORD_HEIGHT).save(OUT / "logo-wordmark.png", optimize=True)

    # Pad the mark to a square so browsers don't crop it into the tab icon.
    side = max(mark.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    square.resize((FAVICON, FAVICON), Image.LANCZOS).save(
        OUT / "favicon-64.png", optimize=True
    )

    for name in ("logo-mark.png", "logo-wordmark.png", "favicon-64.png"):
        path = OUT / name
        print(f"{name:22} {Image.open(path).size!s:12} {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
