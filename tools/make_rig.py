# تفكيك حبر لطبقات - عشان يرمش وعينه تتحرك من غير ملف أنيميشن.
#
# الصورة الثابتة كانت ميتة. الأنيميشن القديم كان فيه روح بس رخصته مش
# بتاعتنا. فبدل ما نرجّعه أو نولّد واحد جديد، بنفصل الصورة اللي نملكها
# لتلات طبقات، والحركة بتتعمل في المتصفح:
#
#   body.png   - حبر كامل، بياض العين موجود، من غير بؤبؤ
#   pupil.png  - بؤبؤ واحد لوحده (بينتسخ مرتين في الكود)
#   blink.png  - نفس حبر بس العينين مقفولين، بيتحط فوق لجزء من الثانية
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

# ---------------------------------------------------------- الرمشة
# الجفن بينزل لحد ما يغطي العين كلها، وبعدين خط رفيع مكان الإغلاق.
im = load()
for k in "LR":
    im = paint_eye(im, k, EYES[k]["lid"], pupil=False)
    im = lower_lid(im, k, 76, copy_shade=True)
lay, dr, merge = overlay(im)
for k in "LR":
    e = EYES[k]
    y = e["lid"] + 62
    curve(dr, arc_pts(e["cx"], y, e["rx"] * 1.5, 7), 6, (86, 58, 178, 255))
im = merge(im)
im.save(f"{OUT}/blink.png")
print("blink")
