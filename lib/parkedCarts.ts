import type { CartItem } from "@/components/Cart";

// ============================================================
// الفواتير المفتوحة في نفس الوقت
// ============================================================
//
// مشكلتين من محل حقيقي (قاف، أسوان) طلعوا نفس المشكلة تحت:
//
// ١. **"فواتير متوازية لو أكتر من زبون موجود."** الكافيه فيه تربيزة
//    طلبت وتربيزة تانية بتطلب. العربية واحدة، فالكاشير مضطر يخلّص
//    الأولى بالعافية أو يفتكر طلب التانية في دماغه.
//
// ٢. **"التنقل أثناء فتح الفاتورة."** العربية كانت `useState` عادي
//    - يعني أي خروج من الشاشة (يبص على المخزون، يسجّل مصروف، يرجع
//    من رسالة واتساب) بيمسحها بالكامل من غير أي سؤال.
//
// الاتنين حلهم واحد: **العربيات تتخزّن**. أول ما تتخزّن، عدد الاتنين
// والتلاتة بيبقى مجاني.
//
// ============================================================
// ليه localStorage مش قاعدة البيانات
// ============================================================
//
// الفاتورة اللي لسه ماتدفعتش مش بيانات محل — دي **ورقة على
// الكاونتر**. لو اتخزّنت في القاعدة يبقى كل حرف بيتكتب فيها رحلة
// شبكة، والكاشير بيشتغل على نت محل مصري.
//
// وde كمان بيخلّيها **محلية للجهاز**، وده الصح: عربيات الكاشير اللي
// على الكاونتر مالهاش أي لازمة على موبايل صاحب المحل في البيت.
//
// ============================================================
// اللي بيتخزّن واللي مابيتخزّنش
// ============================================================
//
// الصنف بيتخزّن كامل (`item`) مش بالـid بس. ليه: العربية لازم تعرف
// ترسم نفسها فورًا من غير ما تستنى قايمة الأصناف تتحمّل.
//
// **والسعر بيتقرا من القاعدة وقت الدفع مهما كان**، فحتى لو السعر
// المخزّن هنا بايت، البيعة بتتسجّل بالسعر الصح (`record_sale`،
// ميجريشن ٠٧٥). المخزّن هنا للعرض بس.

const VERSION = 1;

// أقصى عدد فواتير مفتوحة.
//
// مش حد تقني - ده حد **إدراكي**. كاشير فاتح ٩ فواتير مش فاكر أنهي
// واحدة لأنهي تربيزة. أربع تبويبات هي أكتر حاجة تتقري من نظرة على
// موبايل.
export const MAX_TICKETS = 4;

// العربية المخزّنة بتنتهي بعد الفترة دي.
//
// عربية سايبة من امبارح مش زبون مستني - دي حاجة اتنسيت. ولو فضلت
// ظاهرة، الكاشير هيدوس عليها ذات يوم ويبيعها لحد تاني.
const MAX_AGE_HOURS = 12;

export type Ticket = {
  id: string;
  // اسم الفاتورة: "تربيزة ٣"، "أحمد"، أو رقم لو الكاشير مكتبش حاجة.
  name: string;
  cart: CartItem[];
  createdAt: number;
};

type Stored = {
  version: number;
  activeId: string | null;
  tickets: Ticket[];
};

function storageKey(businessId: string): string {
  return `octopus:carts:${businessId}`;
}

export function newTicketId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** اسم افتراضي: أول رقم مش مستعمل، مش عدد الفواتير + ١. */
export function nextTicketName(tickets: Ticket[]): string {
  for (let n = 1; n <= MAX_TICKETS + 1; n++) {
    const label = `فاتورة ${n}`;

    if (!tickets.some((t) => t.name === label)) return label;
  }

  return "فاتورة";
}

function isFresh(ticket: Ticket, now: number): boolean {
  return now - ticket.createdAt < MAX_AGE_HOURS * 3_600_000;
}

// التحقق من شكل البيانات المقروءة.
//
// localStorage نص يقدر أي حد يعدّله من أدوات المطوّر، ونسخة أقدم من
// البرنامج ممكن تكون كتبت شكل تاني. الشاشة مالهاش أي دفاع غير ده،
// فأي حاجة مش مطابقة بتترمي بدل ما تتصلّح - عربية نص مقروءة أخطر من
// عربية فاضية.
function parseTicket(raw: unknown): Ticket | null {
  if (typeof raw !== "object" || raw === null) return null;

  const t = raw as Record<string, unknown>;

  if (typeof t.id !== "string" || typeof t.name !== "string") return null;
  if (typeof t.createdAt !== "number") return null;
  if (!Array.isArray(t.cart)) return null;

  const cart: CartItem[] = [];

  for (const line of t.cart) {
    if (typeof line !== "object" || line === null) return null;

    const l = line as Record<string, unknown>;
    const item = l.item as Record<string, unknown> | undefined;

    if (!item || typeof item.id !== "string" || typeof item.name !== "string") {
      return null;
    }

    if (typeof l.quantity !== "number" || !Number.isFinite(l.quantity)) {
      return null;
    }

    if (typeof l.total !== "number" || !Number.isFinite(l.total)) return null;

    // كمية أو إجمالي بالسالب مالوش أي معنى في عربية، ومعناه إن
    // التخزين اتعبث فيه.
    if (l.quantity <= 0 || l.total < 0) return null;

    cart.push(line as CartItem);
  }

  return { id: t.id, name: t.name, cart, createdAt: t.createdAt };
}

export function readTickets(
  businessId: string,
  now: number = Date.now()
): { tickets: Ticket[]; activeId: string | null } {
  const empty = { tickets: [], activeId: null };

  if (typeof window === "undefined") return empty;

  let raw: string | null = null;

  // التخزين بيرمي في التصفح الخاص وفي المتصفحات اللي بتمنع بيانات
  // المواقع. الكاشير المفروض يبيع عادي في الحالة دي - من غير
  // فواتير محفوظة بس.
  try {
    raw = window.localStorage.getItem(storageKey(businessId));
  } catch {
    return empty;
  }

  if (!raw) return empty;

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }

  if (typeof parsed !== "object" || parsed === null) return empty;

  const stored = parsed as Partial<Stored>;

  if (stored.version !== VERSION) return empty;
  if (!Array.isArray(stored.tickets)) return empty;

  const tickets = stored.tickets
    .map(parseTicket)
    .filter((t): t is Ticket => t !== null)
    .filter((t) => isFresh(t, now))
    .slice(0, MAX_TICKETS);

  const activeId =
    typeof stored.activeId === "string" &&
    tickets.some((t) => t.id === stored.activeId)
      ? stored.activeId
      : tickets[0]?.id ?? null;

  return { tickets, activeId };
}

export function writeTickets(
  businessId: string,
  tickets: Ticket[],
  activeId: string | null
): void {
  if (typeof window === "undefined") return;

  const payload: Stored = { version: VERSION, activeId, tickets };

  try {
    window.localStorage.setItem(
      storageKey(businessId),
      JSON.stringify(payload)
    );
  } catch {
    // ممتلي أو ممنوع. البيع مايقفش عشان الحفظ فشل.
  }
}
