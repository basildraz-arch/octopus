# مشاعر حبر - بتتولّد من نفس الصورة، مش بتترسم من أول.
#
# ليه كده: أي توليد جديد بيطلّع مخلوق مختلف - عينين مش هي، لون مش هو.
# وده بالظبط اللي اترفض قبل كده. فالصورة الأصلية هي الأساس دايمًا،
# وإحنا بنغيّر الجفن والبؤبؤ والفم بس. النتيجة نفس الشخصية بالمللي.

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = "public/hebr.png"
OUT = "public/hebr"
SS = 4  # رسم بأربع أضعاف الحجم وتصغير - عشان الحواف تطلع ناعمة

CREAM = (205, 196, 179, 255)
CREAM_SH = (168, 158, 146, 255)   # ظل جوه العين تحت الجفن
PUPIL = (22, 31, 77, 255)
GLINT = (245, 245, 250, 255)
MOUTH_DARK = (52, 31, 138, 255)
BROW = (58, 34, 140, 255)

# الإحداثيات اتقيست من الصورة نفسها.
# cx/cy = مركز كرة العين كاملة، lid = خط الجفن في الصورة الأصلية.
EYES = {
    "L": dict(cx=281, cy=372, rx=69, ry=58, lid=355,
              pcx=295, pcy=374, pr=35, gx=-24, gy=-16),
    "R": dict(cx=484, cy=370, rx=72, ry=58, lid=354,
              pcx=474, pcy=374, pr=35, gx=-24, gy=-17),
}
MOUTH = dict(cx=388, cy=454)


def load():
    return Image.open(SRC).convert("RGBA")


def S(v):
    return int(round(v * SS))


# ------------------------------------------------------------------ العين

def paint_eye(im, key, top, pdx=0, pdy=0, pscale=1.0, slope=0.0):
    """يرسم العين من أول: بياض من `top` لتحت، وبؤبؤ جواها.

    top   = أعلى نقطة بيبان فيها بياض العين. أقل من 300 = عين مفتوحة
            على الآخر (دهشة/فزع)، أكبر من 355 = عين نصف مقفولة.
    slope = ميلان حافة الجفن. موجب = الطرف الداخلي (ناحية النص) أنزل،
            وده اللي بيعمل الغضب. سالب = الطرف الخارجي أنزل = حزن.
            الحافة المايلة هي الفرق بين "عين نعسانة" و"عين غضبانة" -
            من غيرها الاتنين بيبقوا نفس الشكل.
    """
    e = EYES[key]
    a = np.array(im)
    h, w = a.shape[:2]
    inner = 1 if key == "L" else -1

    yy, xx = np.ogrid[:h, :w]
    ball = ((xx - e["cx"]) / e["rx"]) ** 2 + ((yy - e["cy"]) / e["ry"]) ** 2 <= 1.0

    top_row = top + slope * (np.arange(w) - e["cx"]) * inner   # حد لكل عمود
    top_row = top_row[None, :]

    visible = ball & (yy >= top_row)

    a[visible] = CREAM

    # ظل رفيع جوه العين تحت حافة الجفن - بيدي عمق ويمنع الشكل المسطّح
    rim = visible & (yy < top_row + 16)
    a[rim] = CREAM_SH

    im2 = Image.fromarray(a)

    # البؤبؤ، متقصقص جوه بياض العين
    r = max(5, e["pr"] * pscale)
    px, py = e["pcx"] + pdx, e["pcy"] + pdy
    lay = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.ellipse([S(px - r), S(py - r), S(px + r), S(py + r)], fill=PUPIL)
    gr = max(2.5, 5 * pscale)
    gx, gy = px + e["gx"] * pscale, py + e["gy"] * pscale
    d.ellipse([S(gx - gr), S(gy - gr), S(gx + gr), S(gy + gr)], fill=GLINT)

    # البؤبؤ بيتقصقص على بياض العين الظاهر بالظبط - فلو الجفن نازل،
    # البؤبؤ بيتقص معاه زي الطبيعي.
    mask = Image.fromarray((visible * 255).astype(np.uint8), "L")

    pupil_img = Image.alpha_composite(im2, lay.resize((w, h), Image.LANCZOS))
    return Image.composite(pupil_img, im2, mask)


def lower_lid(im, key, drop, tilt=0.0):
    """ينزّل الجفن البنفسجي. اللون بيتاخد من نفس العمود فوق الجفن،
    فالتظليل الأصلي بيمتد معاه بدل ما نخترع لون."""
    a = np.array(im)
    e = EYES[key]
    inner = 1 if key == "L" else -1

    for x in range(e["cx"] - e["rx"] - 4, e["cx"] + e["rx"] + 5):
        t = (x - e["cx"]) / e["rx"]
        if abs(t) > 1.12:
            continue
        d = drop * (1 - 0.3 * t * t) + tilt * (t * inner) * e["rx"]
        d = int(round(d))
        if d <= 0:
            continue
        src = a[e["lid"] - 4, x].copy()
        a[e["lid"] - 3: e["lid"] + d, x] = src

    return Image.fromarray(a)


# ------------------------------------------------------------------- الفم

def clear_mouth(im):
    """يمسح الفم بنسخ لون الجسم من تحته - فالتظليل بيفضل مظبوط."""
    a = np.array(im)
    x0, x1 = MOUTH["cx"] - 70, MOUTH["cx"] + 70
    y0, y1 = MOUTH["cy"] - 26, MOUTH["cy"] + 34
    a[y0:y1, x0:x1] = a[y0 + 64: y1 + 64, x0:x1]
    im2 = Image.fromarray(a)
    blur = im2.filter(ImageFilter.GaussianBlur(4))
    mask = Image.new("L", im2.size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle([x0 - 3, y0 - 3, x1 + 3, y0 + 8], fill=255)
    md.rectangle([x0 - 3, y1 - 8, x1 + 3, y1 + 3], fill=255)
    md.rectangle([x0 - 3, y0, x0 + 8, y1], fill=255)
    md.rectangle([x1 - 8, y0, x1 + 3, y1], fill=255)
    return Image.composite(blur, im2, mask.filter(ImageFilter.GaussianBlur(3)))


# ------------------------------------------------------------------ الرسم

def overlay(im):
    lay = Image.new("RGBA", (im.size[0] * SS, im.size[1] * SS), (0, 0, 0, 0))
    return lay, ImageDraw.Draw(lay), lambda base, l=lay: Image.alpha_composite(
        base, l.resize(base.size, Image.LANCZOS))


def curve(d, pts, width, fill):
    d.line([(S(x), S(y)) for x, y in pts], fill=fill, width=S(width), joint="curve")
    r = width * SS / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([S(x) - r, S(y) - r, S(x) + r, S(y) + r], fill=fill)


def arc_pts(cx, cy, w, h, n=28, flip=False):
    out = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        out.append((cx + t * w / 2, cy + h * (1 - t * t) * (-1 if flip else 1)))
    return out
