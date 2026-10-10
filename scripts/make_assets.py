"""Regenerate the PWA icons and the simulator board image in public/ from assets/.

usage: python scripts/make_assets.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS, PUBLIC = ROOT / "assets", ROOT / "public"
NAVY = (46, 86, 144, 255)


def emblem() -> Image.Image:
    """The robot-arm emblem from the blue logo, recoloured white, without the (R) mark or wordmark."""
    logo = Image.open(ASSETS / "matrix-logo.png").convert("RGBA")
    px = logo.load()
    out = Image.new("RGBA", (366, logo.height), (0, 0, 0, 0))
    op = out.load()
    for y in range(logo.height):
        for x in range(366):
            r, g, b, a = px[x, y]
            is_ink = a > 0 and b > r + 40
            is_registered_mark = x >= 318 and y <= 104
            is_wordmark = x >= 290 and y > 165
            if is_ink and not is_registered_mark and not is_wordmark:
                op[x, y] = (255, 255, 255, a)
    return out.crop(out.getbbox())


def icons():
    e = emblem()
    for size, pad, name in ((192, 0.16, "icon-192.png"), (512, 0.16, "icon-512.png"), (512, 0.26, "icon-maskable-512.png")):
        bg = Image.new("RGBA", (size, size), NAVY)
        k = int(size * (1 - 2 * pad)) / max(e.width, e.height)
        scaled = e.resize((round(e.width * k), round(e.height * k)), Image.LANCZOS)
        bg.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
        bg.convert("RGB").save(PUBLIC / name)


def board():
    """Crop the product render to the board; BoardView.tsx positions overlays on this crop."""
    im = Image.open(ASSETS / "mini-r4.png").convert("RGBA")
    box = im.split()[3].point(lambda a: 255 if a > 20 else 0).getbbox()
    assert box == (72, 6, 550, 476), f"board crop moved to {box}: update pos() in src/simulator/BoardView.tsx"
    im.crop(box).save(PUBLIC / "board-r4.webp", "WEBP", quality=88, method=6)


def white_logo():
    Image.open(ASSETS / "matrix-logo-white.png").save(PUBLIC / "logo-white.png")


if __name__ == "__main__":
    icons()
    board()
    white_logo()
    print("public/ assets regenerated")
