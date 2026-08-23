# تنضيف حواف حبر.
#
# الصورة الأصلية كانت على خلفية ورقية، والقص شال الخلفية بس ساب شريط
# رفيع من لونها ملزوق في الحافة. القياس بيقوله بوضوح: متوسط لون
# البكسلات على الحافة (138,148,185) - رمادي مايل للأخضر - بينما جسمه
# الحقيقي (131,105,232) بنفسجي مشبع. الفرق ده هو "الهالة"، وهي السبب
# اللي بيخلي الشكل يبان متقصقص بالمقص مش مرسوم.
#
# التنضيف تلات خطوات:
#   1. اللون: كل بكسل قريب من الحافة بياخد لون أقرب بكسل جوّه الجسم -
#      فالهالة بتتشال من غير ما الشكل يرفع.
#   2. الشفافية: بنقلّص الحد شوية عشان الشريط الملوّث يقع بره.
#   3. التنعيم: بلور خفيف على قناة الشفافية عشان الحافة تبقى ناعمة
#      بدل ما تبقى مسننة.

from PIL import Image
import numpy as np
from scipy import ndimage
import os

SRC = "public/hebr.png"
RAW = "public/hebr-raw.png"

# لو اشتغل السكريبت قبل كده، بنرجع للأصل مش بننضّف المنضّف.
if os.path.exists(RAW):
    src = RAW
else:
    src = SRC
    Image.open(SRC).save(RAW)
    print("kept the original at", RAW)

im = Image.open(src).convert("RGBA")
a = np.array(im).astype(np.float32)
rgb, alpha = a[..., :3], a[..., 3]

# ---- 1. اللون: امسح الهالة ----
core = alpha >= 240
core = ndimage.binary_erosion(core, iterations=3)

# لكل بكسل، فهرس أقرب بكسل "جوّه" الجسم
_, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
clean_rgb = rgb[iy, ix]

# الجوّه يفضل زي ما هو؛ الحافة بس هي اللي بتاخد اللون النضيف
band = ~core & (alpha > 0)
rgb[band] = clean_rgb[band]

# ---- 2 + 3. الشفافية: قلّص، سوّي الحدّ، وبعدين نعّم ----
# القص الأصلي ساب نتوءات صغيرة في الكونتور - الجسم المفروض منحنى
# أملس، والنتوءات دي هي اللي بتخليه يبان "مقصوص غلط". الإغلاق
# المورفولوجي بيسدّ التقويرات والوسيط بيشيل البروزات، والاتنين
# بيشتغلوا على الشكل مش على اللون فالتفاصيل مابتضيعش.
mask = alpha >= 190
mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)))
mask = ndimage.median_filter(mask.astype(np.uint8), size=5).astype(bool)
mask = mask.astype(np.float32)
soft = ndimage.gaussian_filter(mask, 0.9)
new_alpha = np.clip(soft * 1.18, 0, 1) * 255.0

out = np.dstack([rgb, new_alpha]).clip(0, 255).astype(np.uint8)
Image.fromarray(out, "RGBA").save(SRC)

edge = (new_alpha > 40) & (new_alpha < 250)
print("cleaned. edge pixels:", int(edge.sum()))
print("edge rgb now:", rgb[edge].mean(0).round(1))
print("inner rgb    :", rgb[ndimage.binary_erosion(core, iterations=4)].mean(0).round(1))
