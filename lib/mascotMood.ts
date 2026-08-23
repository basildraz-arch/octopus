// مزاج حبر - قناة واحدة أي صفحة تقدر تنادي عليها.
//
// السبب في إنها module مستقلة مش prop: حبر متركّب مرة واحدة في
// الـlayout فوق الراوتر كله، فالصفحات مش بتقدر تمرّرله props. والبديل
// (context provider) كان هيخلي كل صفحة تعيد الرسم مع كل تغيير مزاج.
// هنا الصفحة بتنادي دالة، وحبر لوحده هو اللي بيسمع.
//
// المزاج مؤقت دايمًا وبيرجع "عادي" لوحده. ده مقصود: حبر بيتفاعل مع
// اللي بيحصل، مش بيقعد زعلان طول اليوم.

export type Mood =
  | "neutral"
  | "happy"
  | "sad"
  | "surprised"
  | "scared"
  | "angry";

type Listener = (mood: Mood) => void;

const listeners = new Set<Listener>();
let current: Mood = "neutral";
let resetTimer: ReturnType<typeof setTimeout> | null = null;

export function getMascotMood(): Mood {
  return current;
}

/**
 * يخلي حبر يعبّر عن حاجة لمدة قصيرة وبعدين يرجع طبيعي.
 *
 * @param mood     الشعور
 * @param holdMs   يفضل كام - صفر يعني لحد ما حد يغيّره
 */
export function setMascotMood(mood: Mood, holdMs = 2600) {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  current = mood;
  listeners.forEach((fn) => fn(mood));

  if (mood !== "neutral" && holdMs > 0) {
    resetTimer = setTimeout(() => {
      resetTimer = null;
      current = "neutral";
      listeners.forEach((fn) => fn("neutral"));
    }, holdMs);
  }
}

export function subscribeMascotMood(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
