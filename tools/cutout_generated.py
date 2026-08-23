# تجهيز أي صورة راجعة من مولّد صور، عشان تبقى صالحة للاستعمال.
#
# المولّدات بترجّع JPEG من غير شفافية، وواجهة جيميناي بتطبع مربعات
# الشفافية الرمادية جوه الصورة نفسها. يعني اللي بيوصلك شكله شفاف وهو
# مش شفاف - وأول ما تحطه على خلفية غامقة هتلاقي مربعات.
#
# السكريبت بيعمل تلات حاجات:
#   1. يشيل الخلفية (المربعات أو أي لون) بملء من الحواف - فالورقة
#      اللي في إيده وبياض عينه مابيتشالوش لأنهم محاطين بالجسم.
#   2. ينضّف الهالة: كل بكسل على الحافة بياخد لون أقرب بكسل جوّه.
#   3. يظبط لون الجسم على لون حبر الرسمي بالظبط.
#
# التصحيح اللوني بيتقاس، مش بيتظبط بالنظر: بناخد متوسط البنفسجي في
# الصورة، ونحسب النسبة للمرجع، ونضربها. جربنا نصححه بالكلام مع
# المولّد مرتين - مرة طلع غامق أوي ومرة باهت. الأرقام أسرع.

from PIL import Image
import numpy as np
from scipy import ndimage
import sys, os

HEBR_PURPLE = np.array([0x7F, 0x5D, 0xFE], float)
HEBR_GREEN = np.array([0x3C, 0x96, 0x45], float)


def cutout(src, dst, fix_colour=True, photo_bg=False):
    """photo_bg=True لما الخلفية مشهد مصوّر مش لون واحد.

    الفرق مش تفصيلة: الملء من الحواف بيفترض إن الخلفية لون متجانس.
    مع مشهد أوضة كامل ده بيفشل، فبنعكس المنطق - بدل ما ندوّر على
    الخلفية، بندوّر على الشخصية نفسها. حبر مشبّع (بنفسجي أو أخضر)
    وأي خلفية واقعية بتبقى بيج وبني ورمادي، فالتشبّع لوحده بيفصلهم.
    """
    im = Image.open(src).convert("RGB")
    a = np.array(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    if photo_bg == "flat":
        # خلفية لون واحد بس مش رمادي - زي اللافندر اللي بيطلّعه
        # جيميناي. بنقيس لون الركن نفسه بدل ما نفترضه، وبنملأ من
        # الحواف عشان أي لون قريب جوه الشخصية ما يتشالش.
        corner = a[0:8, 0:8].reshape(-1, 3).mean(0)
        bg_like = np.abs(a - corner).sum(2) < 60
        lab, n = ndimage.label(bg_like)
        border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
        border.discard(0)
        solid = ~np.isin(lab, list(border))

        # حاجتان منفصلتان عن الجسم بيطلعوا في الرندر: ظل الأرض،
        # وعناصر مقصودة زي حروف Z فوق راسه وهو نايم. "أكبر كتلة بس"
        # بتشيل الاتنين - وده كان هيضيّع الـZ.
        #
        # الفرق بينهم إن الظل **أغمق** من الخلفية وأي عنصر مرسوم
        # بيبقى أفتح أو مختلف بوضوح. فبنقيس السطوع.
        lab2, n2 = ndimage.label(solid)
        if n2 > 1:
            sizes = ndimage.sum(solid, lab2, range(1, n2 + 1))
            main = int(np.argmax(sizes)) + 1
            bg_lum = corner.mean()
            keep = np.zeros_like(solid)
            for i in range(1, n2 + 1):
                part = lab2 == i
                if i == main:
                    keep |= part
                elif part.sum() > 200 and a[part].mean() > bg_lum + 4:
                    keep |= part          # عنصر مرسوم، مش ظل
            solid = keep
    elif photo_bg:
        subject = ((b > r + 25) & (b > g + 35)) | ((g > r + 25) & (g > b + 25))

        # الإغلاق ده مش تجميل - من غيره الأطراف الخضرا بتتشال.
        # بين البنفسجي والأخضر فيه شريط انتقالي مش داخل في أي شرط،
        # فالقطعتين بيتفصلوا، و"أكبر كتلة" بتاخد الجسم وتسيب الخضرا
        # برة. حصل فعلًا: أول تشغيلة رجعت بصفر أخضر.
        subject = ndimage.binary_closing(subject, structure=np.ones((11, 11)))

        lab, n = ndimage.label(subject)
        sizes = ndimage.sum(subject, lab, range(1, n + 1))
        # أكبر كتلة متصلة - عشان أي بقعة لونها قريب في الخلفية تتشال
        solid = lab == (int(np.argmax(sizes)) + 1)
        solid = ndimage.binary_closing(solid, structure=np.ones((15, 15)))
        solid = ndimage.binary_fill_holes(solid)
    else:
        mx = a.max(2)
        mn = a.min(2)
        sat = mx - mn

        # المربعات الرمادية: فاتحة وبلا تشبّع. الشرط واسع شوية عشان ضغط
        # الـJPEG بيسيب تشويش على الحواف.
        bg_like = (sat < 26) & (mn > 170)

        # ملء من الحواف فقط - ده اللي بيحمي الورقة وبياض العين، لأنهم
        # فاتحين وبلا تشبّع بردو بس مش متوصلين بالإطار.
        lab, n = ndimage.label(bg_like)
        border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
        border.discard(0)
        solid = ~np.isin(lab, list(border))

    if photo_bg == "flat":
        # ظل الأرض الملتصق بالجسم.
        #
        # الظل المنفصل بيتشال بقاعدة السطوع فوق، بس اللي تحت الأذرع
        # ملتصق بالجسم فبيعدّي معاه وبيبان بقعة رمادية باهتة. الفرق
        # إن حبر مشبّع (بنفسجي أو أخضر) والظل رمادي، والشرط محصور في
        # النص السفلي عشان بياض العين ما يتأثرش.
        h = a.shape[0]
        sat = a.max(2) - a.min(2)
        yy = np.arange(h)[:, None]
        # جرّبنا نضيف شرط السطوع كمان (lum > 168) عشان نمسك آخر
        # بقايا الظل - فأكل حتت من الأذرع، لأن الأجزاء المضيئة من
        # الجسم بتوصل لنفس السطوع. بقعة باهتة أهون من ذراع ناقصة.
        shadow = solid & (sat < 48) & (yy > h * 0.60)
        if shadow.any():
            solid = solid & ~shadow
            print("  شال ظل ملتصق: %d px" % int(shadow.sum()))

    # نتوءات وثقوب صغيرة من التشويش
    solid = ndimage.binary_closing(solid, structure=np.ones((5, 5)))
    solid = ndimage.binary_fill_holes(solid)
    solid = ndimage.median_filter(solid.astype(np.uint8), size=5).astype(bool)

    # تنضيف الهالة
    core = ndimage.binary_erosion(solid, iterations=3)
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    clean = a[iy, ix]
    band = solid & ~core
    a[band] = clean[band]

    if fix_colour:
        # كل لون يتصحح جوه قناعه هو.
        #
        # كنت بضرب الصورة كلها في نسبة البنفسجي - وde كان بيرفع الأزرق
        # في الأطراف الخضرا كمان فتميل للتركوازي. الفحص الذاتي هو اللي
        # كشفها: الأخضر نزل من 3.6% لـ0.4% بعد "التصحيح".
        for name, target, sel in (
            ("body ", HEBR_PURPLE,
             lambda r, g, b: (b > r + 40) & (b > g + 60)),
            ("tips ", HEBR_GREEN,
             lambda r, g, b: (g > r + 25) & (g > b + 20)),
        ):
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            m = solid & sel(r, g, b)
            if m.sum() < 300:
                continue
            have = a[m].mean(0)
            soft = ndimage.gaussian_filter(m.astype(float), 1.5)[..., None]
            shifted = np.clip(a * (target / have), 0, 255)
            a = np.clip(a * (1 - soft) + shifted * soft, 0, 255)
            print("  %s #%02X%02X%02X -> #%02X%02X%02X (target #%02X%02X%02X)"
                  % (name, *have.astype(int), *a[m].mean(0).astype(int),
                     *target.astype(int)))

    alpha = ndimage.gaussian_filter(solid.astype(float), 0.9)
    alpha = np.clip(alpha * 1.18, 0, 1) * 255

    out = np.dstack([a, alpha]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst)

    # فحص ذاتي: نسبة الأخضر في المرجع 4.2%. لو قربت من صفر يبقى
    # القص أكل الأطراف - وده بيحصل بصمت من غير الفحص ده.
    vis = out[..., 3] > 128
    gr = ((out[..., 1].astype(int) > out[..., 0] + 25)
          & (out[..., 1].astype(int) > out[..., 2] + 25) & vis)
    pct = 100 * gr.sum() / max(1, vis.sum())
    flag = "  <-- الأطراف الخضرا ضاعت" if pct < 1.0 else ""
    print("  wrote %s | character %.1f%% of frame | green tips %.1f%%%s"
          % (dst, 100 * solid.mean(), pct, flag))


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    photo = "flat" if "--flat" in sys.argv else ("--photo" in sys.argv)
    src = args[0]
    dst = args[1] if len(args) > 1 else os.path.splitext(src)[0] + "-clean.png"
    cutout(src, dst, photo_bg=photo)
