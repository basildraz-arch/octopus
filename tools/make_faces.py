import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hebr_faces import *          # noqa
from PIL import Image, ImageDraw, ImageFilter

os.makedirs(OUT, exist_ok=True)
TEAR = (150, 220, 255, 220)


def save(im, name):
    im.save(f"{OUT}/{name}.png")
    print("wrote", f"{OUT}/{name}.png")


# ------------------------------------------------------------ عادي
save(load(), "neutral")

# ------------------------------------------------------------ فرحان
# العين مفتوحة أكتر شوية والبؤبؤ لفوق، وابتسامة مفتوحة.
im = load()
im = paint_eye(im, "L", 330, pdy=-6)
im = paint_eye(im, "R", 330, pdy=-6)
im = clear_mouth(im)
lay, d, merge = overlay(im)
d.pieslice([S(334), S(408), S(442), S(506)], 12, 168, fill=MOUTH_DARK)
d.pieslice([S(356), S(456), S(420), S(502)], 12, 168, fill=(206, 88, 132, 255))
for cx in (214, 552):
    d.ellipse([S(cx - 34), S(446), S(cx + 34), S(480)], fill=(255, 110, 155, 90))
im = merge(im)
save(im, "happy")

# ------------------------------------------------------------ زعلان
# جفن نازل من الطرف الخارجي، بؤبؤ لتحت، حواجب طرفها الداخلي لفوق.
im = load()
for k in "LR":
    im = paint_eye(im, k, 364, pdy=14, slope=-0.26)
im = clear_mouth(im)
lay, d, merge = overlay(im)
curve(d, arc_pts(388, 474, 76, 15, flip=True), 9, MOUTH_DARK)
curve(d, [(218, 342), (272, 316), (330, 326)], 11, BROW)
curve(d, [(440, 326), (498, 316), (552, 342)], 11, BROW)
d.ellipse([S(210), S(438), S(244), S(488)], fill=TEAR)
d.polygon([(S(227), S(420)), (S(244), S(460)), (S(210), S(460))], fill=TEAR)
im = merge(im)
save(im, "sad")

# ------------------------------------------------------------ متفاجئ
im = load()
im = paint_eye(im, "L", 300, pdy=4, pscale=0.9)
im = paint_eye(im, "R", 300, pdy=4, pscale=0.9)
im = clear_mouth(im)
lay, d, merge = overlay(im)
d.ellipse([S(364), S(428), S(412), S(494)], fill=MOUTH_DARK)
curve(d, [(220, 268), (280, 250), (340, 268)], 11, BROW)
curve(d, [(428, 268), (488, 250), (548, 268)], 11, BROW)
im = merge(im)
save(im, "surprised")

# ------------------------------------------------------------ خايف
# نفس العين المفتوحة بس البؤبؤ صغير ومزوّغ للناحية التانية.
im = load()
im = paint_eye(im, "L", 300, pdx=8, pdy=8, pscale=0.62)
im = paint_eye(im, "R", 300, pdx=-8, pdy=8, pscale=0.62)
im = clear_mouth(im)
lay, d, merge = overlay(im)
import math
wave = [(340 + i * 4.0, 464 + 11 * math.sin(i / 24 * math.pi * 3))
        for i in range(25)]
curve(d, wave, 11, MOUTH_DARK)
curve(d, [(222, 272), (280, 256), (338, 276)], 10, BROW)
curve(d, [(430, 276), (488, 256), (546, 272)], 10, BROW)
d.ellipse([S(576), S(198), S(614), S(250)], fill=TEAR)
d.polygon([(S(595), S(178)), (S(614), S(224)), (S(576), S(224))], fill=TEAR)
im = merge(im)
save(im, "scared")

# ------------------------------------------------------------ غضبان
# الجفن مايل بقوة من الطرف الداخلي + حواجب تخينة نازلة للنص.
im = load()
for k in "LR":
    im = paint_eye(im, k, 352, pdy=-2, slope=0.34)
im = clear_mouth(im)
lay, d, merge = overlay(im)
curve(d, arc_pts(388, 480, 82, 17, flip=True), 11, MOUTH_DARK)
curve(d, [(214, 314), (276, 306), (342, 360)], 15, BROW)
curve(d, [(426, 360), (492, 306), (554, 314)], 15, BROW)
# علامة غضب
for a0 in (0, 90):
    d.pieslice([S(586), S(224), S(654), S(292)], a0 + 18, a0 + 72,
               fill=(226, 64, 72, 255))
im = merge(im)
save(im, "angry")
