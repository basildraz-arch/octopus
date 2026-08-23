# تحويل صورة تعبير مولّدة لطبقة شفافة تتركّب على رِّج حبر.
#
# ليه مش بنستعمل الصورة زي ما هي: لو بدّلنا الصورة كلها، حبر بيبطّل
# يرمش وعينه تبطّل تتبع الماوس في اللحظة اللي بيعبّر فيها. فالمطلوب
# نطلّع من الصورة **الفرق** بينها وبين الوجه العادي، ونحطه كطبقة فوق
# نفس الرِّج - فالرمشة والنظرة يفضلوا شغالين.
#
# المحاذاة بالقياس مش بالنظر: بنلاقي مركز البؤبؤين في الصورتين، ونحسب
# التصغير والإزاحة اللي بيخلوهم ينطبقوا. اتقاس على أول تعبير فطلع
# التصغير 1.0004 والفرق الرأسي 1% - يعني المولّد بيرسم في نفس الإطار
# لما تقوله "الكاميرا مااتحركتش".
#
# البؤبؤ بيتشال من الطبقة عن قصد: بؤبؤ حبر عنصر مستقل بيتحرك بالكود،
# ولو سبناه مرسوم في الطبقة هيبقى فيه بؤبؤين - واحد ثابت وواحد بيتحرك.

from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
import sys, os

sys.path.insert(0, os.path.dirname(__file__))
from cutout_generated import cutout          # noqa

REF = "public/hebr.png"
BODY = "public/hebr/body.png"
OUT = "public/hebr"


def pupil_centres(rgb, alpha=None, W=None):
    """مركز العينين، من بياض العين.

    مش "أكبر بقعتين داكنتين" - ده فشل على تعبير الغضب لأن البؤبؤ فيه
    صغير جدًا، فمسك بقعتين تانيتين قريبين من بعض وطلّع تصغير 21 ضعف
    وإزاحة 16 ألف بكسل. والأسوأ إنه كتب الملف عادي من غير ما يشتكي.
    فبقى بيدوّر على **الزوج** اللي منطقي: على نفس الارتفاع تقريبًا،
    والمسافة بينهم في حدود ربع عرض الصورة زي المرجع.
    """
    # بياض العين مش البؤبؤ.
    #
    # البؤبؤ بيتحرك جوه العين حسب اتجاه النظرة، فلما التعبير بيبص
    # لجنب (الخايف والغضبان) المسافة بين البؤبؤين بتتغير والمحاذاة
    # بتطلع غلط - وde اللي حصل فعلًا: تصغير 0.97 بدل 0.75. بياض
    # العين ثابت مكانه مهما اتحركت النظرة.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = (r > 185) & (g > 175) & (b > 140) & (r - b > 8) & (r - b < 100)
    if alpha is not None:
        m &= alpha > 128
    lab, n = ndimage.label(m)
    if n < 2:
        raise SystemExit("ما لقيتش بؤبؤين")

    W = W or rgb.shape[1]
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    cand = []
    for i in np.argsort(sizes)[::-1][:8]:
        if sizes[i] < 400:
            continue
        ys, xs = np.nonzero(lab == (i + 1))
        cand.append((xs.mean(), ys.mean(), sizes[i]))

    best, score = None, None
    for i in range(len(cand)):
        for j in range(i + 1, len(cand)):
            a1, a2 = sorted([cand[i], cand[j]])
            gap = (a2[0] - a1[0]) / W
            dy = abs(a2[1] - a1[1]) / W
            if not (0.16 < gap < 0.38) or dy > 0.06:
                continue
            # الأقرب للنسبة المرجعية (0.232) والأكثر تساويًا في الحجم
            sc = abs(gap - 0.264) + dy + abs(a1[2] - a2[2]) / max(a1[2], a2[2]) * 0.1
            if score is None or sc < score:
                best, score = (a1[:2], a2[:2]), sc

    if best is None:
        raise SystemExit("ما لقيتش زوج بؤبؤين منطقي - الصورة مش وقفة أمامية؟")
    return [best[0], best[1]]


def build(src, name, full=False):
    tmp = "/tmp/_mood_cut.png"
    cutout(src, tmp, photo_bg="flat")

    ref = np.array(Image.open(REF).convert("RGBA"))
    body = np.array(Image.open(BODY).convert("RGBA")).astype(int)
    N = ref.shape[0]

    cut = Image.open(tmp).convert("RGBA")
    a = np.array(cut)

    rp = pupil_centres(ref[..., :3].astype(int), ref[..., 3])
    np_ = pupil_centres(a[..., :3].astype(int), a[..., 3])

    scale = (rp[1][0] - rp[0][0]) / (np_[1][0] - np_[0][0])

    # حارس: أي رسمة بنفس الإطار لازم تصغيرها يبقى قريب من 0.75
    # (768 من 1024). لو خرج عن ده يبقى الكاشف مسك حاجة غلط، والأحسن
    # يقف بصوت بدل ما يكتب طبقة مكسورة.
    if not (0.4 < scale < 1.6):
        raise SystemExit(
            "تصغير غير منطقي (%.2f) - الكاشف مسك حاجة مش البؤبؤ" % scale)
    new_w = max(1, round(cut.width * scale))
    cut = cut.resize((new_w, max(1, round(cut.height * scale))), Image.LANCZOS)

    # بعد التصغير، الإزاحة اللي بتخلي منتصف البؤبؤين ينطبق
    mid_ref = ((rp[0][0] + rp[1][0]) / 2, (rp[0][1] + rp[1][1]) / 2)
    mid_new = (((np_[0][0] + np_[1][0]) / 2) * scale,
               ((np_[0][1] + np_[1][1]) / 2) * scale)
    dx = round(mid_ref[0] - mid_new[0])
    dy = round(mid_ref[1] - mid_new[1])

    canvas = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    canvas.paste(cut, (dx, dy), cut)
    print("  محاذاة: تصغير %.4f  إزاحة (%d, %d)" % (scale, dx, dy))

    if full:
        # الصورة كاملة، متحاذية على نفس الإطار.
        #
        # جرّبنا نطلّع الوش كطبقة والباقي من الأصل - الفكرة سليمة
        # نظريًا (حبر يفضل يرمش وهو بيعبّر) بس النتيجة كانت وحشة:
        # تظليل الرأس في الرسمة المولّدة مختلف عن الأصل، فحدود منطقة
        # القص كانت بتبان كرقعة أفتح على وشه. القياس مايكشفش ده -
        # الصورة بالحجم الكامل هي اللي كشفته.
        #
        # فالتعبير بقى صورة كاملة. الثمن إن الرمشة وتتبع النظرة
        # بيقفوا ثانيتين وقت التعبير - والطوفان والميل والنَفَس
        # بيفضلوا شغالين لأنهم على العنصر الحاوي مش على الصورة.
        canvas.save(f"{OUT}/{name}.png")
        print("  %-18s صورة كاملة متحاذية" % name)
        return

    al = np.array(canvas).astype(int)

    # اللي اتغيّر عن الوجه العادي
    changed = (np.abs(al[..., :3] - body[..., :3]).max(axis=2) > 22) & (al[..., 3] > 100)

    # حصر الطبقة في منطقة الوش.
    #
    # الجسم المولّد مش مطابق للأصل بالمللي - الأذرع بتيجي بانحناءة
    # مختلفة شوية - فالفرق كان بيشمل حتت من الجسم وبتطلع بقع رمادية
    # طايرة. إحنا عايزين الوش وبس: العينين والفم والخدود.
    yy, xx = np.ogrid[:N, :N]
    face = (((xx - 384) / 250.0) ** 2 + ((yy - 400) / 165.0) ** 2) <= 1.0
    face = ndimage.binary_dilation(face, iterations=6)
    changed &= face

    # شيل البؤبؤ - بيتحرك بالكود
    r, g, b = al[..., 0], al[..., 1], al[..., 2]
    pupil = (r < 90) & (g < 90) & (b < 150) & (b > r)
    pupil = ndimage.binary_dilation(pupil, iterations=3)
    changed &= ~pupil

    # نضّف البقع الصغيرة المتناثرة
    lab, n = ndimage.label(changed)
    if n:
        sizes = ndimage.sum(changed, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 150])
        changed = keep

    out = al.copy()
    out[..., 3] = np.where(changed, 255, 0)
    img = Image.fromarray(out.clip(0, 255).astype("uint8"), "RGBA")
    img.putalpha(img.split()[3].filter(ImageFilter.GaussianBlur(1.4)))
    img.save(f"{OUT}/{name}.png")
    print("  %-18s %6d px" % (name, int(changed.sum())))


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], full="--full" in sys.argv)
