
from gtts import gTTS
lines = [
 ("owner1", "الفلوس داخلة الدرج طول اليوم، وآخر الشهر بلاقي نفسي مديون."),
 ("hebr1", "إنت بتحسبها إزاي؟"),
 ("owner2", "بشوف الدرج."),
 ("hebr2", "أهو ده السبب."),
 ("hebr3", "الدرج بيقولك دخل كام، مبيقولكش كلّفك كام."),
]
import os
os.makedirs(r"C:/Users/LOGO/Desktop/octopus/marketing/reel", exist_ok=True)
for name, t in lines:
    gTTS(text=t, lang="ar").save(rf"C:/Users/LOGO/Desktop/octopus/marketing/reel/{name}.mp3")
    print("saved", name)
