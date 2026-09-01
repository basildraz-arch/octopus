# توليد كادرات ريل «مش عارف كسبت ولا خسرت» — ١٦ ثانية، ٩:١٦.
#
# تشغيل:
#   python build_frames.py            # يولّد الكادرات في frames/
#   python build_frames.py --preview  # كادر واحد كل ثانية بس، للمعاينة السريعة
#
# وبعدين:  bash final.sh
#
# ============================================================
# اللي اتغيّر عن النسخة الأولى، وليه
# ============================================================
#
# **١. عين حبر كانت بتتكسر — والسبب اتقاس مش اتخمّن.**
#
# النسخة القديمة كان فيها دالة بتشيل البكسلات البيضا عشان تعمل
# شفافية. بس صور حبر في `public/hebr/` **أصلًا شفافة** - الشفافية
# اتعملت بالقص الحقيقي. فالدالة كانت بتشتغل على صورة مقصوصة خلاص،
# وبتاكل أي أبيض **جوه** الشخصية.
#
# القياس: `mood-happy.png` فيها **٤٤٠ بكسل أفتح من 235 جوه الشخصية** -
# دي نقطة الضوء في كل عين. بتتشال، فالعين بتبقى فيها خرم أسود. وde
# بالظبط اللي بان في الكارت الأخير.
#
# الحل: مانلمسش الألفا. الصورة جاية مقصوصة، نستعملها زي ما هي.
# (وde كمان بيصلّح الأطراف الخضرا المقصوصة - `getbbox()` بعد المسح
# كان بيقص الحدود اللي المسح أكلها.)
#
# **٢. الريل كان شرائح مش فيديو.**
#
# الحركة كانت طوفان ٢٤ بكسل على شخصية ٩٠٠ بكسل - يعني ٢.٧٪. مالهاش
# وجود على شاشة موبايل. دلوقتي فيه:
#   - زووم بطيء مستمر في كل مشهد (Ken Burns)
#   - دخول وخروج بانتقال متدرّج بين المشاهد
#   - النص بيظهر بحركة مش بيوقع فجأة
#
# **٣. البرنامج بقى بيبان.**
#
# أهم حاجة في إعلان لبرنامج هي البرنامج. النسخة القديمة كان فيها
# لقطة واحدة في الآخر. دلوقتي التلات لقطات بتعدّي بزووم بطيء.
#
# **٤. الخط.**
#
# كان `arialbd.ttf`. خط Arial العربي رفيع وباهت، وشكله بيخلي النص
# يبان زي ترجمة أفلام. السكريبت دلوقتي بيدوّر على Cairo أو Almarai
# أو Tajawal، **وبيقف بصوت** لو مالقاش - مش بيقع على Arial بصمت.
#
# نزّل Cairo مجانًا: https://fonts.google.com/specimen/Cairo
# وحطّه في الفولدر ده أو سطّبه في ويندوز.

import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from arabic_text import shape as ar  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "frames")

W, H, FPS, DUR = 1080, 1920, 30, 16
TOTAL = DUR * FPS

BG_TOP = (5, 7, 14)
BG_BOT = (10, 18, 34)
PURPLE = (155, 127, 245)
TEAL = (23, 195, 178)
PAPER = (245, 246, 250)
MIST = (176, 182, 200)

PREVIEW = "--preview" in sys.argv


# ============================================================
# الخط
# ============================================================

FONT_CANDIDATES = [
    os.path.join(HERE, "Cairo-Bold.ttf"),
    os.path.join(HERE, "Almarai-Bold.ttf"),
    "C:/Windows/Fonts/Cairo-Bold.ttf",
    "C:/Windows/Fonts/Almarai-Bold.ttf",
    "C:/Windows/Fonts/Tajawal-Bold.ttf",
    "/usr/share/fonts/truetype/google-fonts/Cairo-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def find_font():
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path

    raise SystemExit(
        "مالقيتش خط عربي عريض.\n"
        "نزّل Cairo من https://fonts.google.com/specimen/Cairo\n"
        f"وحطّ Cairo-Bold.ttf في: {HERE}\n\n"
        "مابقعش على Arial عن قصد - خطه العربي بيخلي الإعلان شكله "
        "ترجمة أفلام."
    )


FONT_PATH = find_font()
print(f"الخط: {FONT_PATH}")

if "DejaVu" in FONT_PATH:
    print("  ⚠ ده خط احتياطي وشكله العربي عادي. للنتيجة النهائية نزّل Cairo.")


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


F_HEAD = font(84)
F_LINE = font(62)
F_BRAND = font(132)
F_URL = font(42)


# ============================================================
# أدوات
# ============================================================

def ease_out(t):
    """بطء في الآخر - الحركة الطبيعية لأي حاجة بتقف."""
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    return 3 * t * t - 2 * t * t * t


def clamp01(x):
    return max(0.0, min(1.0, x))


_grad_cache = None


def base_frame():
    """خلفية غامقة بتدرّج أزرق تحت - إيحاء عمق مياه."""
    global _grad_cache

    if _grad_cache is None:
        img = Image.new("RGB", (W, H), BG_TOP)
        grad = Image.new("L", (1, H))

        for y in range(H):
            f = max(0.0, (y - H * 0.45) / (H * 0.55))
            grad.putpixel((0, y), int(255 * (f ** 1.6) * 0.55))

        grad = grad.resize((W, H))
        blue = Image.new("RGB", (W, H), BG_BOT)
        _grad_cache = Image.composite(blue, img, grad)

    return _grad_cache.copy()


BUBBLES = [
    dict(x0=180, y0=1500, speed=28, r=16),
    dict(x0=850, y0=1700, speed=22, r=11),
    dict(x0=520, y0=1850, speed=35, r=8),
    dict(x0=300, y0=1600, speed=19, r=13),
]


def draw_bubbles(img, t):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    for b in BUBBLES:
        y = (b["y0"] - b["speed"] * t) % (H + 200) - 100
        x = b["x0"] + 20 * math.sin(t * 0.8 + b["y0"])
        r = b["r"]

        d.ellipse([x - r, y - r, x + r, y + r], outline=(155, 127, 245, 110), width=2)
        d.ellipse([x - r + 3, y - r + 3, x - r + 9, y - r + 9], fill=(255, 255, 255, 60))

    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


_char_cache = {}


def load_char(name):
    """صورة حبر زي ما هي - **من غير أي لمس للشفافية**.

    الصور في public/hebr/ مقصوصة خلاص. أي محاولة "نشيل الأبيض" هنا
    بتاكل نقطة الضوء في العين (٤٤٠ بكسل في mood-happy) وبتسيب خرم
    أسود مكانها.
    """
    if name in _char_cache:
        return _char_cache[name]

    path = os.path.join(BASE, "public", "hebr", f"{name}.png")

    if not os.path.exists(path):
        path = os.path.join(BASE, "marketing", f"{name}.png")

    im = Image.open(path).convert("RGBA")

    # القص على حدود الشفافية الموجودة - مش على لون
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)

    _char_cache[name] = im
    return im


def paste_char(img, name, cx, cy, height, opacity=1.0):
    im = load_char(name)
    ratio = height / im.height
    im = im.resize((max(1, int(im.width * ratio)), max(1, int(height))), Image.LANCZOS)

    if opacity < 1.0:
        alpha = im.split()[3].point(lambda v: int(v * opacity))
        im.putalpha(alpha)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(im, (int(cx - im.width / 2), int(cy - im.height / 2)), im)

    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def rounded(im, rad=44):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], rad, fill=255)

    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


_shot_cache = {}


def load_shot(fname):
    if fname not in _shot_cache:
        _shot_cache[fname] = Image.open(
            os.path.join(BASE, "marketing", "shots", fname)
        ).convert("RGBA")

    return _shot_cache[fname]


def paste_shot(img, fname, t_in, zoom_from=1.0, zoom_to=1.12):
    """لقطة شاشة بزووم بطيء - عشان الشاشة الثابتة تبان حية."""
    shot = load_shot(fname)

    zoom = zoom_from + (zoom_to - zoom_from) * clamp01(t_in)
    target_w = int(880 * zoom)

    sh = shot.resize(
        (target_w, int(target_w * shot.height / shot.width)), Image.LANCZOS
    )
    sh = rounded(sh, 44)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    x0 = W // 2 - sh.width // 2
    y0 = H // 2 - 120 - sh.height // 2
    sd.rounded_rectangle([x0 + 14, y0 + 22, x0 + sh.width + 14, y0 + sh.height + 22],
                         44, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))

    img = Image.alpha_composite(img.convert("RGBA"), shadow).convert("RGB")

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(sh, (x0, y0), sh)

    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def draw_lines(img, lines, y, f, fill=PAPER, appear=1.0, scrim=True):
    """نص في التلت العلوي، بخلفية غامقة خفيفة عشان يتقرا فوق أي حاجة.

    النص بيدخل من تحت شوية مع الشفافية - سقوط النص فجأة بيبان رخيص.
    """
    if appear <= 0:
        return img

    shaped = [ar(line) for line in lines]
    d0 = ImageDraw.Draw(img)

    widths, heights = [], []
    for s in shaped:
        box = d0.textbbox((0, 0), s, font=f)
        widths.append(box[2] - box[0])
        heights.append(box[3] - box[1])

    gap = int(f.size * 0.42)
    block_h = sum(heights) + gap * (len(shaped) - 1)
    block_w = max(widths) if widths else 0

    rise = int((1 - ease_out(appear)) * 40)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    if scrim and block_w:
        pad_x, pad_y = 46, 34
        d.rounded_rectangle(
            [
                W // 2 - block_w // 2 - pad_x,
                y - pad_y + rise,
                W // 2 + block_w // 2 + pad_x,
                y + block_h + pad_y + rise,
            ],
            28,
            fill=(5, 7, 14, int(165 * appear)),
        )

    cy = y + rise
    alpha = int(255 * clamp01(appear))

    for s, h in zip(shaped, heights):
        d.text((W // 2, cy), s, font=f, fill=(*fill, alpha), anchor="ma")
        cy += h + gap

    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


# ============================================================
# المشاهد
# ============================================================
#
# التوقيت بيانات مش شروط متداخلة - عشان تعدّل ثانية من غير ما تفتح
# منطق الرسم.

SCENES = [
    dict(t0=0.0,  t1=1.2,  kind="title",
         lines=["شكاوى محلات القاع"]),

    dict(t0=1.2,  t1=4.6,  kind="char", char="mood-sad", size=860,
         lines=["الفلوس داخلة الدرج طول اليوم…", "وآخر الشهر بلاقي نفسي مديون."]),

    dict(t0=4.6,  t1=6.0,  kind="char", char="mood-sad", size=860,
         lines=["مش عارف كسبت ولا خسرت"], big=True),

    dict(t0=6.0,  t1=7.2,  kind="slide", char="mood-surprised", size=820,
         lines=["إنت بتحسبها إزاي؟"], color=PURPLE),

    dict(t0=7.2,  t1=8.6,  kind="char", char="mood-sad", size=860,
         lines=["بشوف الدرج."]),

    dict(t0=8.6,  t1=10.0, kind="char", char="neutral", size=800,
         lines=["أهو ده السبب."], color=TEAL),

    dict(t0=10.0, t1=12.0, kind="shot", shot="01-day-close.jpg",
         lines=["الدرج بيقولك دخل كام."]),

    dict(t0=12.0, t1=13.4, kind="shot", shot="03-items-mobile.jpg",
         lines=["مبيقولكش كلّفك كام."]),

    dict(t0=13.4, t1=14.4, kind="shot", shot="02-sales-log.jpg",
         lines=["كل بيعة، ومين عملها."]),

    dict(t0=14.4, t1=16.0, kind="outro"),
]


def scene_at(t):
    for s in SCENES:
        if s["t0"] <= t < s["t1"]:
            return s
    return SCENES[-1]


def render(t):
    img = base_frame()
    img = draw_bubbles(img, t)

    s = scene_at(t)
    dur = s["t1"] - s["t0"]
    local = (t - s["t0"]) / dur          # 0 → 1 جوه المشهد
    appear = clamp01((t - s["t0"]) / 0.45)

    # خفوت في آخر ربع ثانية من كل مشهد - بيمنع القطع الحاد
    fade_out = clamp01((s["t1"] - t) / 0.25)

    kind = s["kind"]
    color = s.get("color", PAPER)

    if kind == "title":
        img = draw_lines(img, s["lines"], H // 2 - 60, F_HEAD,
                         appear=appear * fade_out, scrim=False)

    elif kind in ("char", "slide"):
        # زووم بطيء مستمر: ٤٪ على طول المشهد. مش ملحوظ كحركة، بس
        # الفرق بينه وبين الثبات هو الفرق بين فيديو وصورة.
        zoom = 1.0 + 0.04 * ease_in_out(local)
        bob = 26 * math.sin(t * 1.5)

        cx = W // 2

        if kind == "slide":
            cx = int(W // 2 + (1 - ease_out(clamp01(local / 0.3))) * (W + 400))

        img = paste_char(img, s["char"], cx, int(H * 0.46 + bob),
                         s["size"] * zoom, opacity=fade_out)

        f = F_HEAD if s.get("big") else F_LINE
        img = draw_lines(img, s["lines"], int(H * 0.13), f,
                         fill=color, appear=appear * fade_out)

    elif kind == "shot":
        img = paste_shot(img, s["shot"], local)
        img = draw_lines(img, s["lines"], int(H * 0.10), F_LINE,
                         appear=appear * fade_out)

        # حبر صغير في الركن - بيفضل موجود وإحنا بنوري البرنامج
        img = paste_char(img, "neutral", 165, H - 250, 300, opacity=0.95 * fade_out)

    else:  # outro
        zoom = 1.0 + 0.05 * ease_in_out(local)
        img = paste_char(img, "mood-happy", W // 2, int(H * 0.40), 700 * zoom,
                         opacity=appear)

        img = draw_lines(img, ["الأخطبوط"], int(H * 0.66), F_BRAND,
                         fill=PAPER, appear=appear, scrim=False)

        img = draw_lines(img, ["octopus-fawn-three.vercel.app"], int(H * 0.76),
                         F_URL, fill=MIST, appear=clamp01((local - 0.25) / 0.3),
                         scrim=False)

    return img


def main():
    os.makedirs(OUT, exist_ok=True)

    step = FPS if PREVIEW else 1
    written = 0

    for frame in range(0, TOTAL, step):
        img = render(frame / FPS)
        img.save(os.path.join(OUT, f"f{frame:05d}.png"))

        written += 1
        if written % 30 == 0:
            print(f"  {frame}/{TOTAL}")

    print(f"خلصت: {written} كادر في {OUT}")

    if PREVIEW:
        print("دي معاينة (كادر كل ثانية). شغّل من غير --preview للريل الكامل.")


if __name__ == "__main__":
    main()
