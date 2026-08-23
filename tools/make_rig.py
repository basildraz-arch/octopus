# تفكيك حبر لطبقات - عشان يرمش وعينه تتحرك من غير ملف أنيميشن.
#
# الصورة الثابتة كانت ميتة. الأنيميشن القديم كان فيه روح بس رخصته مش
# بتاعتنا. فبدل ما نرجّعه أو نولّد واحد جديد، بنفصل الصورة اللي نملكها
# لتلات طبقات، والحركة بتتعمل في المتصفح:
#
#   body.png   - حبر كامل، بياض العين موجود، من غير بؤبؤ
#   pupil.png  - بؤبؤ واحد لوحده (بينتسخ مرتين في الكود)
#   lid-half   - الجفن نص نازل (طبقة شفافة، البؤبؤ باين تحتها)
#   lid-shut   - الجفن مقفول تمامًا
#
# الفايدة إن البؤبؤ بقى عنصر مستقل - يتحرك ورا الماوس أو يبص حواليه
# لوحده، والرمشة بقت تبديل صورة، مش ملف ٢٠٠ كيلوبايت.

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hebr_faces import *          # noqa
from PIL import Image, ImageDraw

os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------- الجسم
# بياض العين مرسوم، البؤبؤ لأ. الطبقة دي مابتتحركش خالص.
im = load()
for k in "LR":
    im = paint_eye(im, k, EYES[k]["lid"], pupil=False)
im.save(f"{OUT}/body.png")
print("body")

# ---------------------------------------------------------- البؤبؤ
# مرسوم لوحده على خلفية شفافة بنفس مقاس الأصل، عشان الكود يحطه
# بنسبة مئوية من عرض حبر ومايبقاش فيه حساب بالبكسل.
R = EYES["L"]["pr"]
box = int(R * 2.6)
lay = Image.new("RGBA", (box * SS, box * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(lay)
c = box / 2
d.ellipse([S(c - R), S(c - R), S(c + R), S(c + R)], fill=PUPIL)
d.ellipse([S(c - 24 - 5), S(c - 16 - 5), S(c - 24 + 5), S(c - 16 + 5)], fill=GLINT)
lay.resize((box, box), Image.LANCZOS).save(f"{OUT}/pupil.png")
print("pupil", box)

# ------------------------------------------------- الجفن كطبقة لوحده
# الرمشة الأولى كانت صورة كاملة بتتحط فوق الكل، فالبؤبؤ كان بيختفي
# تحتها. ده تمام لما العين مقفولة تمامًا، بس مش تمام لنص رمشة - هناك
# الجفن المفروض يغطي النص الأعلى من العين والبؤبؤ يفضل باين تحته.
#
# فبنطلّع الجفن كطبقة شفافة: بنرسم العين والجفن نازل، وبنقارن بالجسم،
# واللي اتغيّر بس هو اللي بيتحفظ. الباقي شفاف.
import numpy as np

body = np.array(Image.open(f"{OUT}/body.png").convert("RGBA")).astype(int)

def lid_layer(drop, name):
    im = load()
    for k in "LR":
        im = paint_eye(im, k, EYES[k]["lid"], pupil=False)
        im = lower_lid(im, k, drop, copy_shade=True)
    if drop > 60:                       # مقفولة: خط الإغلاق
        lay, dr, merge = overlay(im)
        for k in "LR":
            e = EYES[k]
            curve(dr, arc_pts(e["cx"], e["lid"] + 62, e["rx"] * 1.5, 7), 6,
                  (86, 58, 178, 255))
        im = merge(im)

    a = np.array(im).astype(int)
    changed = np.abs(a[..., :3] - body[..., :3]).max(axis=2) > 6
    out = a.copy()
    out[..., 3] = np.where(changed, 255, 0)
    img = Image.fromarray(out.clip(0, 255).astype("uint8"), "RGBA")
    # تنعيم حافة الطبقة عشان ما تبانش مقصوصة فوق العين
    al = img.split()[3].filter(ImageFilter.GaussianBlur(1.2))
    img.putalpha(al)
    img.save(f"{OUT}/{name}.png")
    print(name)

from PIL import ImageFilter
lid_layer(34, "lid-half")
lid_layer(76, "lid-shut")
