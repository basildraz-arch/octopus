# تشكيل النص العربي للرسم على صورة.
#
# ليه الملف ده موجود أصلًا: PIL بيرسم الحروف واحد ورا التاني زي ما هي
# في النص، والعربي مش كده - الحرف شكله بيتغير حسب اللي قبله واللي
# بعده، والسطر بيتقرا من اليمين. من غير المعالجة دي بيطلع حروف
# مقطّعة ومقلوبة.
#
# `arabic_reshaper` + `python-bidi` بيعملوا ده وأحسن. الملف ده بديل
# **لما ما يكونوش متسطبين** - عشان السكريبت يشتغل على أي جهاز من غير
# ما تسطّب حاجة. لو المكتبتين موجودين، `shape()` بتستعملهم.
#
# القصور المعروف: خوارزمية bidi الحقيقية أعقد من كده بكتير (مستويات
# تداخل، أرقام، علامات). اللي هنا بيمشي صح مع جملة عربية فيها كلمات
# لاتينية أو أرقام - وde كل اللي محتاجينه في ريل إعلاني.

# لكل حرف: (منفصل، آخر الكلمة، أول الكلمة، وسط الكلمة)
# None معناها إن الحرف مالوش الشكل ده - يعني بيوصل باللي قبله بس.
FORMS = {
    "ء": ("ﺀ", None, None, None),          # ء
    "آ": ("ﺁ", "ﺂ", None, None),      # آ
    "أ": ("ﺃ", "ﺄ", None, None),      # أ
    "ؤ": ("ﺅ", "ﺆ", None, None),      # ؤ
    "إ": ("ﺇ", "ﺈ", None, None),      # إ
    "ئ": ("ﺉ", "ﺊ", "ﺋ", "ﺌ"),  # ئ
    "ا": ("ﺍ", "ﺎ", None, None),      # ا
    "ب": ("ﺏ", "ﺐ", "ﺑ", "ﺒ"),  # ب
    "ة": ("ﺓ", "ﺔ", None, None),      # ة
    "ت": ("ﺕ", "ﺖ", "ﺗ", "ﺘ"),  # ت
    "ث": ("ﺙ", "ﺚ", "ﺛ", "ﺜ"),  # ث
    "ج": ("ﺝ", "ﺞ", "ﺟ", "ﺠ"),  # ج
    "ح": ("ﺡ", "ﺢ", "ﺣ", "ﺤ"),  # ح
    "خ": ("ﺥ", "ﺦ", "ﺧ", "ﺨ"),  # خ
    "د": ("ﺩ", "ﺪ", None, None),      # د
    "ذ": ("ﺫ", "ﺬ", None, None),      # ذ
    "ر": ("ﺭ", "ﺮ", None, None),      # ر
    "ز": ("ﺯ", "ﺰ", None, None),      # ز
    "س": ("ﺱ", "ﺲ", "ﺳ", "ﺴ"),  # س
    "ش": ("ﺵ", "ﺶ", "ﺷ", "ﺸ"),  # ش
    "ص": ("ﺹ", "ﺺ", "ﺻ", "ﺼ"),  # ص
    "ض": ("ﺽ", "ﺾ", "ﺿ", "ﻀ"),  # ض
    "ط": ("ﻁ", "ﻂ", "ﻃ", "ﻄ"),  # ط
    "ظ": ("ﻅ", "ﻆ", "ﻇ", "ﻈ"),  # ظ
    "ع": ("ﻉ", "ﻊ", "ﻋ", "ﻌ"),  # ع
    "غ": ("ﻍ", "ﻎ", "ﻏ", "ﻐ"),  # غ
    "ف": ("ﻑ", "ﻒ", "ﻓ", "ﻔ"),  # ف
    "ق": ("ﻕ", "ﻖ", "ﻗ", "ﻘ"),  # ق
    "ك": ("ﻙ", "ﻚ", "ﻛ", "ﻜ"),  # ك
    "ل": ("ﻝ", "ﻞ", "ﻟ", "ﻠ"),  # ل
    "م": ("ﻡ", "ﻢ", "ﻣ", "ﻤ"),  # م
    "ن": ("ﻥ", "ﻦ", "ﻧ", "ﻨ"),  # ن
    "ه": ("ﻩ", "ﻪ", "ﻫ", "ﻬ"),  # ه
    "و": ("ﻭ", "ﻮ", None, None),      # و
    "ى": ("ﻯ", "ﻰ", None, None),      # ى
    "ي": ("ﻱ", "ﻲ", "ﻳ", "ﻴ"),  # ي
}

# لام + ألف بيتكتبوا حرف واحد. من غير ده بيطلعوا حرفين ملزوقين وشكلهم
# غلط - وde أكتر تركيب في العربي.
LAM_ALEF = {
    "آ": ("ﻵ", "ﻶ"),
    "أ": ("ﻷ", "ﻸ"),
    "إ": ("ﻹ", "ﻺ"),
    "ا": ("ﻻ", "ﻼ"),
}

# التشكيل بيتشال: الخطوط اللي بنرسم بيها مش بتحطه في مكانه الصح لما
# نرسم حرف حرف، فبيطلع طايح فوق الكلمة.
DIACRITICS = set("ًٌٍَُِّْـ")


def _joins_forward(ch):
    """الحرف ده بيوصل باللي بعده؟ (ا و د ر ز لأ)"""
    f = FORMS.get(ch)
    return bool(f and f[2])


def _is_arabic(ch):
    return ch in FORMS or ch in DIACRITICS


def _reshape(text):
    text = "".join(c for c in text if c not in DIACRITICS)

    out = []
    i = 0

    while i < len(text):
        ch = text[i]

        # لام + ألف
        if ch == "ل" and i + 1 < len(text) and text[i + 1] in LAM_ALEF:
            prev = out[-1] if out else ""
            joined_before = bool(prev) and _joins_forward_shaped(prev)
            iso, fin = LAM_ALEF[text[i + 1]]
            out.append(fin if joined_before else iso)
            i += 2
            continue

        if ch not in FORMS:
            out.append(ch)
            i += 1
            continue

        prev_ch = text[i - 1] if i > 0 else ""
        next_ch = text[i + 1] if i + 1 < len(text) else ""

        before = _joins_forward(prev_ch)
        after = next_ch in FORMS or (next_ch and next_ch in LAM_ALEF and False)

        iso, fin, ini, med = FORMS[ch]

        if before and after and med:
            out.append(med)
        elif before and fin:
            out.append(fin)
        elif after and ini:
            out.append(ini)
        else:
            out.append(iso)

        i += 1

    return "".join(out)


# بعد التشكيل الحروف بقت أشكال عرض، فمحتاجين نعرف الشكل ده بيوصل
# بعده ولا لأ عشان لام-ألف اللي بعده.
_FORWARD_SHAPES = set()
for _iso, _fin, _ini, _med in FORMS.values():
    if _ini:
        _FORWARD_SHAPES.add(_ini)
    if _med:
        _FORWARD_SHAPES.add(_med)


def _joins_forward_shaped(shaped_ch):
    return shaped_ch in _FORWARD_SHAPES


def _rtl(text):
    """قلب السطر للعرض من اليمين، مع إبقاء الأرقام واللاتيني بترتيبهم."""
    runs = []
    buf = ""
    buf_is_ltr = None

    for ch in text:
        # الأرقام والحروف اللاتينية بتتقرا من الشمال حتى جوه جملة عربية
        is_ltr = ch.isascii() and (ch.isalnum() or ch in ".:%/-+")

        if buf and is_ltr != buf_is_ltr:
            runs.append((buf, buf_is_ltr))
            buf = ""

        buf += ch
        buf_is_ltr = is_ltr

    if buf:
        runs.append((buf, buf_is_ltr))

    out = ""
    for chunk, is_ltr in reversed(runs):
        out += chunk if is_ltr else chunk[::-1]

    return out


def shape(text):
    """النص جاهز للرسم بـPIL.

    بيستعمل arabic_reshaper و python-bidi لو موجودين - هما أدق.
    ولو مش موجودين بيقع على التنفيذ اللي فوق.
    """
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return get_display(arabic_reshaper.reshape(text))
    except ImportError:
        return _rtl(_reshape(text))


if __name__ == "__main__":
    for sample in [
        "الفلوس داخلة الدرج طول اليوم",
        "مش عارف كسبت ولا خسرت",
        "الأخطبوط",
        "بعت بـ 1200 جنيه",
    ]:
        print(sample, "->", shape(sample))
