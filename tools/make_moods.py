# مشاعر حبر كطبقات شفافة، مش كصور كاملة.
#
# لو المشاعر صور كاملة بتتبدّل، حبر بيتجمّد وقت ما بيعبّر: بيبطّل يرمش
# وعينه تبطّل تتبع الماوس - يعني يموت في اللحظة اللي المفروض يبقى فيها
# أكتر حيوية. وده عكس المطلوب بالظبط.
#
# فكل شعور بقى مجموعة طبقات صغيرة شفافة بتترص فوق نفس الرِّج:
#
#   eyes-wide-*.png  بياض عين زيادة لفوق (دهشة/فزع/فرح)
#   lid-*.png        جفن مايل (حزن/غضب)
#   face-*.png       الفم والحواجب والدمعة والعرق وعلامة الغضب
#
# والبؤبؤ والرمشة بيفضلوا شغالين بالكود زي ما هم. النتيجة: حبر بيرمش
# وهو زعلان، وعينه بتتبعك وهو غضبان.
#
# كل طبقة بتتولّد بالمقارنة: بنرسم الحالة كاملة، ونطرح منها الجسم
# الأساسي، واللي اتغير بس هو اللي بيتحفظ.

import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from hebr_faces import *          # noqa
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

TEAR = (150, 220, 255, 220)
BODY = None


def base_body():
    im = load()
    for k in "LR":
        im = paint_eye(im, k, EYES[k]["lid"], pupil=False)
    return im


def diff_layer(im, name, feather=1.2):
    """يحفظ اللي اتغيّر عن الجسم الأساسي بس."""
    a = np.array(im).astype(int)
    changed = np.abs(a[..., :3] - BODY[..., :3]).max(axis=2) > 6
    out = a.copy()
    out[..., 3] = np.where(changed, 255, 0)
    img = Image.fromarray(out.clip(0, 255).astype("uint8"), "RGBA")
    img.putalpha(img.split()[3].filter(ImageFilter.GaussianBlur(feather)))
    img.save(f"{OUT}/{name}.png")
    px = int(changed.sum())
    print("  %-16s %6d px" % (name, px))
    if px < 200:
        print("      ^ فاضية تقريبًا - الطبقة دي مش هتبان")


def eyes_wide(top, name):
    im = base_body()
    for k in "LR":
        im = paint_eye(im, k, top, pupil=False)
    diff_layer(im, name)


def lid(name, drop, tilt):
    im = base_body()
    for k in "LR":
        im = lower_lid(im, k, drop, tilt=tilt)
    diff_layer(im, name)


def face(name, draw_fn):
    im = base_body()
    im = clear_mouth(im)
    lay, d, merge = overlay(im)
    draw_fn(d)
    diff_layer(merge(im), name)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    BODY = np.array(base_body()).astype(int)

    # ---- عيون أوسع ----
    eyes_wide(332, "eyes-wide-1")     # فرح: مفتوحة شوية زيادة
    eyes_wide(300, "eyes-wide-2")     # دهشة وفزع: مفتوحة على الآخر

    # ---- جفون مايلة ----
    lid("lid-sad", 26, -0.16)         # الطرف الخارجي نازل
    lid("lid-angry", 22, 0.30)        # الطرف الداخلي نازل

    # ---- الوجوه ----
    def happy(d):
        d.pieslice([S(334), S(408), S(442), S(506)], 12, 168, fill=MOUTH_DARK)
        d.pieslice([S(356), S(456), S(420), S(502)], 12, 168, fill=(206, 88, 132, 255))
        for cx in (214, 552):
            d.ellipse([S(cx - 34), S(446), S(cx + 34), S(480)], fill=(255, 110, 155, 95))

    def sad(d):
        curve(d, arc_pts(388, 474, 76, 15, flip=True), 9, MOUTH_DARK)
        curve(d, [(218, 342), (272, 316), (330, 326)], 11, BROW)
        curve(d, [(440, 326), (498, 316), (552, 342)], 11, BROW)
        d.ellipse([S(210), S(438), S(244), S(488)], fill=TEAR)
        d.polygon([(S(227), S(420)), (S(244), S(460)), (S(210), S(460))], fill=TEAR)

    def surprised(d):
        d.ellipse([S(364), S(428), S(412), S(494)], fill=MOUTH_DARK)
        curve(d, [(220, 268), (280, 250), (340, 268)], 11, BROW)
        curve(d, [(428, 268), (488, 250), (548, 268)], 11, BROW)

    def scared(d):
        wave = [(340 + i * 4.0, 464 + 11 * math.sin(i / 24 * math.pi * 3))
                for i in range(25)]
        curve(d, wave, 11, MOUTH_DARK)
        curve(d, [(222, 272), (280, 256), (338, 276)], 10, BROW)
        curve(d, [(430, 276), (488, 256), (546, 272)], 10, BROW)
        d.ellipse([S(576), S(198), S(614), S(250)], fill=TEAR)
        d.polygon([(S(595), S(178)), (S(614), S(224)), (S(576), S(224))], fill=TEAR)

    def angry(d):
        curve(d, arc_pts(388, 480, 82, 17, flip=True), 11, MOUTH_DARK)
        curve(d, [(214, 314), (276, 306), (342, 360)], 15, BROW)
        curve(d, [(426, 360), (492, 306), (554, 314)], 15, BROW)
        for a0 in (0, 90):
            d.pieslice([S(586), S(224), S(654), S(292)], a0 + 18, a0 + 72,
                       fill=(226, 64, 72, 255))

    for n, fn in (("happy", happy), ("sad", sad), ("surprised", surprised),
                  ("scared", scared), ("angry", angry)):
        face("face-" + n, fn)
