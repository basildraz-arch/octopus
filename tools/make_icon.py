# أيقونة التطبيق - بتتعمل من صورة حبر نفسها، مش بتتولّد.
#
# جرّبنا نطلّعها من مولّد الصور فرجع مخلوق تاني: طلبنا "الرأس والعينين
# بس" فشال الأذرع - واللي بيقول إنه أخطبوط هو الأذرع. الأيقونة اللي
# مالهاش أذرع بتبقى وش، مش أخطبوط.
#
# النسخة الأولى من السكريبت ده طلعت مبكسلة وأطرافها مقصوصة، والسببين
# مكتوبين تحت عند كل إصلاح - عشان ما يتكرروش.

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = "public/hebr.png"
INK = (5, 7, 14, 255)          # #05070E - خلفية البرنامج نفسها
GLOW = (127, 93, 254, 105)     # #7F5DFE
SS = 4                         # للخلفية والقناع بس، مش للشخصية


def build(size=512, fill=0.68, circle=True):
    im = Image.open(SRC).convert("RGBA")
    im = im.crop(im.split()[3].getbbox())     # شيل الفراغ الشفاف

    S = size * SS

    # ---- الخلفية والقناع: بيترسموا بأربع أضعاف عشان الحافة تبقى ناعمة
    shape = Image.new("L", (S, S), 0)
    sd = ImageDraw.Draw(shape)
    if circle:
        sd.ellipse([0, 0, S - 1, S - 1], fill=255)
    else:
        sd.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    mask = shape.resize((size, size), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(Image.new("RGBA", (size, size), INK), (0, 0), mask)

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [size * 0.20, size * 0.16, size * 0.80, size * 0.76], fill=GLOW)
    glow = glow.filter(ImageFilter.GaussianBlur(size // 11))
    canvas = Image.alpha_composite(canvas, glow)

    # ---- الشخصية: تصغير واحد مباشر من الأصل للمقاس النهائي.
    #
    # الغلطة الأولى كانت هنا: كنت بكبّرها لأربع أضعاف مع الخلفية
    # وبعدين أصغّر الكل. الرحلة دي (تكبير ثم تصغير) بتاكل الحدة
    # وبتطلّع الحواف مبكسلة. دلوقتي الشخصية بتتصغّر مرة واحدة من
    # 768 للمقاس اللي هتتحط بيه فعلًا - تصغير نضيف من غير تكبير.
    scale = (size * fill) / max(im.size)
    body = im.resize((max(1, round(im.width * scale)),
                      max(1, round(im.height * scale))), Image.LANCZOS)

    # الغلطة التانية: fill كان 0.80 فالأذرع كانت بتلمس حافة الدايرة
    # وتتقص. 0.68 بتسيب هامش، والتوسيط بيتحسب من مربع محيط الشخصية
    # نفسه مش من الصورة الأصلية.
    canvas.paste(body, ((size - body.width) // 2,
                        (size - body.height) // 2), body)

    canvas = Image.composite(canvas, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)

    # الشخصية لوحدها على شفاف - عشان الفحص يقيسها هي مش الخلفية
    solo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    solo.paste(body, ((size - body.width) // 2, (size - body.height) // 2), body)
    solo = Image.composite(solo, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask)

    return canvas, solo


def check(solo, label):
    """هل الشخصية نفسها اتقصت؟

    الفحص الأول كان بيقيس ألفا الصورة كلها - والخلفية المفروض تملا
    الإطار، فكان بيطلّع إنذار كاذب على كل أيقونة. الصح إننا نقيس
    طبقة الشخصية لوحدها: لو مساحتها بعد القص أقل من قبله، يبقى
    اتأكل منها حتة.
    """
    a = np.array(solo)[..., 3]
    box = Image.fromarray(a).getbbox()
    n = a.shape[0]
    gap = min(box[0], box[1], n - box[2], n - box[3]) if box else 0
    print("  %-13s %dpx | أقرب مسافة بين الشخصية وحافة الإطار: %dpx%s"
          % (label, n, gap, "  <-- ملزوقة في الحافة" if gap < 4 else ""))


if __name__ == "__main__":
    r, r_solo = build(512, circle=True)
    sq, sq_solo = build(512, circle=False)
    r.save("public/hebr/icon-round.png")
    sq.save("public/hebr/icon-square.png")
    r.save("app/icon.png")
    check(r_solo, "icon-round")
    check(sq_solo, "icon-square")
