# Build 16s vertical reel frames for "Al-Okhtobot" ad
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import arabic_reshaper
from bidi.algorithm import get_display

BASE = r"C:/Users/LOGO/Desktop/octopus"
OUT = os.path.join(BASE, "marketing", "reel", "frames")
os.makedirs(OUT, exist_ok=True)

W, H, FPS, DUR = 1080, 1920, 30, 16
TOTAL = DUR * FPS

BG_TOP = (5, 7, 14)      # #05070E
BG_BOT = (10, 18, 34)    # subtle deep blue gradient

def ar(text):
    return get_display(arabic_reshaper.reshape(text))

FONT_BD = "C:/Windows/Fonts/arialbd.ttf"
FONT_RG = "C:/Windows/Fonts/segoeui.ttf"

def load_font(path, size):
    return ImageFont.truetype(path, size)

def draw_text(draw, xy, text, font, fill=(255,255,255), anchor="mm"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)

def base_frame(t):
    """Background: dark with deep-blue bottom gradient."""
    img = Image.new("RGB", (W, H), BG_TOP)
    px = img.load()
    grad = Image.new("L", (1, H))
    for y in range(H):
        f = max(0.0, (y - H*0.45) / (H*0.55))  # gradient only lower part
        grad.putpixel((0, y), int(255 * (f**1.6) * 0.55))
    grad = grad.resize((W, H))
    blue = Image.new("RGB", (W, H), BG_BOT)
    img = Image.composite(blue, img, grad)
    return img

def bubble_positions():
    """3 small bubbles, deterministic slow upward drift."""
    return [
        dict(x0=180, y_base=1500, speed=28, r=16),
        dict(x0=850, y_base=1700, speed=22, r=11),
        dict(x0=520, y_base=1850, speed=35, r=8),
    ]

def draw_bubbles(img, t):
    overlay = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    Hh = float(H)
    for b in bubble_positions():
        y = (b["y_base"] - b["speed"] * t) % (Hh + 200) - 100
        x = b["x0"] + 20*math.sin(t*0.8 + b["y_base"])
        r = b["r"]
        d.ellipse([x-r, y-r, x+r, y+r], outline=(155,127,245,110), width=2)
        d.ellipse([x-r+3, y-r+3, x-r+9, y-r+9], fill=(255,255,255,60))
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"), (0,0))
    return img

def paste_center(img, im, cx, cy, scale=None, target_w=None):
    im = im.copy()
    if target_w:
        ratio = target_w / im.width
        im = im.resize((target_w, int(im.height*ratio)), Image.LANCZOS)
    elif scale:
        im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
    img.paste(im, (cx - im.width//2, cy - im.height//2), im)
    return img

def load_hebr(path, size):
    """Load Habr image, key out near-white background -> RGBA, resize to height=size."""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    thr = 235
    for yy in range(h):
        for xx in range(w):
            r_, g_, b_, a_ = px[xx, yy]
            if r_ > thr and g_ > thr and b_ > thr:
                px[xx, yy] = (r_, g_, b_, 0)
            elif r_ > 215 and g_ > 215 and b_ > 215:
                # soften edge
                lum = (r_ + g_ + b_) / 3
                alpha = int(max(0, min(255, (thr - lum) * 6)))
                px[xx, yy] = (r_, g_, b_, alpha)
    # crop to content then resize
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    ratio = size / im.height
    im = im.resize((int(im.width*ratio), size), Image.LANCZOS)
    return im

HEBR_SAD = os.path.join(BASE, "public", "hebr", "mood-sad.png")
HEBR_SUP = os.path.join(BASE, "public", "hebr", "mood-surprised.png")
HEBR_HAP = os.path.join(BASE, "public", "hebr", "mood-happy.png")
HEBR_POINT = os.path.join(BASE, "marketing", "hebr-point.png")
SHOT_DAYCLOSE = os.path.join(BASE, "marketing", "shots", "01-day-close.jpg")

hebr_sad = load_hebr(HEBR_SAD, 900)
hebr_sup = load_hebr(HEBR_SUP, 800)
hebr_hap = load_hebr(HEBR_HAP, 700)
hebr_point = load_hebr(HEBR_POINT, 620)

shot = Image.open(SHOT_DAYCLOSE).convert("RGBA")

def rounded(im, rad=48):
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, im.width-1, im.height-1], rad, fill=255)
    out = Image.new("RGBA", im.size, (0,0,0,0))
    out.paste(im, (0,0), mask)
    return out

f_title  = load_font(FONT_BD, 88)
f_sub    = load_font(FONT_RG, 56)
f_brand  = load_font(FONT_BD, 120)
f_url    = load_font(FONT_RG, 44)
f_small  = load_font(FONT_RG, 46)

PURPLE = (155, 127, 245)
TEAL   = (23, 195, 178)

n_done = 0
for frame in range(TOTAL):
    t = frame / FPS
    img = base_frame(t)

    if t < 1.0:
        # Scene 0: title
        img = draw_bubbles(img, t)
        d = ImageDraw.Draw(img)
        draw_text(d, (W//2, H//2 - 40), ar("شكاوى محلات القاع"), f_title)
        # fade-in via brightness approx: redraw is fine at 30fps start
    elif t < 4.5:
        # Scene 1: sad hebr floating gently
        img = draw_bubbles(img, t)
        bob = int(24 * math.sin(t * 1.4))
        img = paste_center(img, hebr_sad, W//2, H//2 - 80 + bob)
        d = ImageDraw.Draw(img)
        if t >= 1.2:
            draw_text(d, (W//2, H - 320), ar("الفلوس داخلة الدرج طول اليوم…"), f_sub)
            draw_text(d, (W//2, H - 250), ar("وآخر الشهر بلاقي نفسي مديون."), f_sub, fill=(220,222,232))
    elif t < 6.0:
        # Scene 2: same sad shot + white caption low
        img = draw_bubbles(img, t)
        bob = int(24 * math.sin(t * 1.4))
        img = paste_center(img, hebr_sad, W//2, H//2 - 80 + bob)
        d = ImageDraw.Draw(img)
        draw_text(d, (W//2, H - 280), ar("مش عارف كسبت ولا خسرت"), f_title, fill=(245,246,250))
    elif t < 7.0:
        # Scene 3: surprised slides in from side
        img = draw_bubbles(img, t)
        prog = min(1.0, (t - 6.0) / 0.35)
        ease = 1 - (1 - prog)**3
        xoff = int((1 - ease) * (W + 500))
        img = paste_center(img, hebr_sup, W//2 + xoff, H//2 - 100)
        d = ImageDraw.Draw(img)
        draw_text(d, (W//2, H - 300), ar("إنت بتحسبها إزاي؟"), f_sub, fill=PURPLE)
    elif t < 9.0:
        # Scene 4: sad again
        img = draw_bubbles(img, t)
        bob = int(24 * math.sin(t * 1.4))
        img = paste_center(img, hebr_sad, W//2, H//2 - 80 + bob)
        d = ImageDraw.Draw(img)
        draw_text(d, (W//2, H - 300), ar("بشوف الدرج."), f_sub)
    elif t < 10.0:
        # Scene 5: hebr points
        img = draw_bubbles(img, t)
        img = paste_center(img, hebr_point, W//2, H//2 - 80)
        d = ImageDraw.Draw(img)
        draw_text(d, (W//2, H - 300), ar("أهو ده السبب."), f_sub, fill=TEAL)
    else:
        # Scene 6: app screenshot fills screen + small hebr corner; then outro
        if t < 14.0:
            img = draw_bubbles(img, t)
            sh = shot.resize((900, int(900 * shot.height / shot.width)), Image.LANCZOS)
            sh = rounded(sh, 44)
            # soft shadow
            shad = Image.new("RGBA", (sh.width+60, sh.height+60), (0,0,0,0))
            sd = ImageDraw.Draw(shad)
            sd.rounded_rectangle([30, 30, sh.width+30, sh.height+30], 44, fill=(0,0,0,140))
            shad = shad.filter(ImageFilter.GaussianBlur(18))
            shad_full = Image.new("RGBA", (W, H), (0,0,0,0))
            shad_full.paste(shad, (W//2 - sh.width//2 - 30, H//2 - 60 - sh.height//2 - 30))
            img = Image.alpha_composite(img.convert("RGBA"), shad_full).convert("RGB")
            img = paste_center(img, sh, W//2, H//2 - 60)
            # small hebr bottom-left
            hb = hebr_point.resize((260, int(hebr_point.height * 260 / hebr_point.width)), Image.LANCZOS)
            img.paste(hb, (70, H - hb.height - 90), hb)
            d = ImageDraw.Draw(img)
            draw_text(d, (W//2, H - 210), ar("الدرج بيقولك دخل كام."), f_small)
            draw_text(d, (W//2, H - 150), ar("مبيقولكش كلّفك كام."), f_small, fill=(220,222,232))
        else:
            img = draw_bubbles(img, t)
            img = paste_center(img, hebr_hap, W//2, H//2 - 160)
            d = ImageDraw.Draw(img)
            draw_text(d, (W//2, H//2 + 260), ar("الأخطبوط"), f_brand, fill=PURPLE)
            draw_text(d, (W//2, H//2 + 400), "octopus-fawn-three.vercel.app", f_url, fill=(154,161,184))

    img.save(os.path.join(OUT, f"f{frame:05d}.png"))
    n_done += 1
    if n_done % 120 == 0:
        print("frames:", n_done)

print("done", n_done)
