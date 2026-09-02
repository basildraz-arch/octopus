// ============================================================
// صحة المحل — قاعدة واحدة، شاشتين
// ============================================================
//
// باسل: "عايزه يبقى الأساس يقدر يشوف ويتحكم في كل حاجة بحيث أكون
// عامل حوكمة للبزنس بتاعي كله."
//
// الحوكمة مش «شاشة فيها كل الأرقام». الشاشة اللي فيها كل الأرقام
// محدش بيفتحها. الحوكمة إن **المحل اللي فيه مشكلة يطلع لوحده فوق**
// وانت مش بتدوّر.
//
// الملف ده نقي عن قصد (نمط AGENTS §٦): بياخد أرقام ويرجّع تنبيهات،
// من غير أي اتصال بقاعدة بيانات. عشان نفس القاعدة تشتغل في مسار
// الماستر (كل المحلات) وفي شاشة المحل الواحد، من غير ما النسختين
// يفترقوا مع الوقت.

export type HealthLevel = "danger" | "warn" | "info";

export type HealthFlag = {
  level: HealthLevel;
  // سطر واحد بالعربي، مكتوب لباسل مش للمبرمج.
  text: string;
  // مفتاح ثابت عشان الترتيب والفلترة.
  key: string;
};

export type ShopHealthInput = {
  active: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;

  itemCount: number;
  employeeCount: number;
  staffLimit: number;

  salesCount30d: number;
  lastSaleAt: string | null;

  /** أقدم وردية لسه مفتوحة. */
  openShiftSince: string | null;

  /** أصناف مخزونها وصل الحد الأدنى أو تحته. */
  lowStockCount: number;

  /** عربيات اتحطّ فيها بضاعة وسكتت (آخر ٧ أيام). */
  abandonedCarts7d: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function daysBetween(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

// الترتيب مقصود: الأخطر الأول، وجوه كل مستوى الأحدث تأثيرًا.
const LEVEL_ORDER: Record<HealthLevel, number> = {
  danger: 0,
  warn: 1,
  info: 2,
};

export function shopHealth(
  input: ShopHealthInput,
  now: number = Date.now()
): HealthFlag[] {
  const flags: HealthFlag[] = [];

  // ------------------------------------------------------------
  // الاشتراك
  // ------------------------------------------------------------

  if (!input.active) {
    flags.push({
      key: "suspended",
      level: "danger",
      text: "المحل موقوف — مش بيقدر يبيع",
    });
  }

  const endsAt = input.subscriptionExpiresAt ?? input.trialEndsAt;

  if (endsAt) {
    const msLeft = new Date(endsAt).getTime() - now;
    const daysLeft = Math.ceil(msLeft / DAY);
    const paying = input.subscriptionExpiresAt != null;

    if (msLeft <= 0) {
      flags.push({
        key: "expired",
        level: "danger",
        text: paying
          ? `الاشتراك خلص من ${Math.abs(daysLeft)} يوم`
          : `التجربة خلصت من ${Math.abs(daysLeft)} يوم`,
      });
    } else if (daysLeft <= 7) {
      flags.push({
        key: "expiring",
        level: "warn",
        text: paying
          ? `الاشتراك بيخلص خلال ${daysLeft} يوم`
          : `التجربة بتخلص خلال ${daysLeft} يوم — دي لحظة القرار`,
      });
    }
  }

  // ------------------------------------------------------------
  // هو شغّال أصلًا؟
  // ------------------------------------------------------------
  //
  // الفرق بين "محل سجّل وماستعملش" و"محل كان بيشتغل ووقف" هو أهم
  // فرق في القايمة دي - الأول محتاج مكالمة تعريف، والتاني محتاج
  // مكالمة إنقاذ.

  if (input.itemCount === 0) {
    flags.push({
      key: "empty",
      level: "warn",
      text: "مفيش ولا صنف — الحساب اتعمل وماتظبطش",
    });
  } else if (!input.lastSaleAt) {
    flags.push({
      key: "never-sold",
      level: "warn",
      text: "دخّل أصنافه وماباعش ولا مرة",
    });
  } else {
    const quietDays = daysBetween(input.lastSaleAt, now);

    if (quietDays >= 14) {
      flags.push({
        key: "silent",
        level: "danger",
        text: `ماباعش من ${quietDays} يوم — يحتمل يكون ساب البرنامج`,
      });
    } else if (quietDays >= 5) {
      flags.push({
        key: "quiet",
        level: "warn",
        text: `آخر بيعة من ${quietDays} يوم`,
      });
    }
  }

  // ------------------------------------------------------------
  // الوردية المفتوحة
  // ------------------------------------------------------------
  //
  // دي شكوى كيرو رقم ٢ حرفيًا ("بيسجل فواتير قديمة كتير"). وردية
  // فضلت مفتوحة ٧٤ ساعة خلّت كل شاشة مربوطة بالوردية توري ٣ أيام
  // كأنهم النهاردة.

  if (input.openShiftSince) {
    const hours = Math.floor((now - new Date(input.openShiftSince).getTime()) / HOUR);

    if (hours >= 48) {
      flags.push({
        key: "shift-stale",
        level: "danger",
        text: `وردية مفتوحة من ${Math.floor(hours / 24)} يوم — أرقام اليوم عنده غلط`,
      });
    } else if (hours >= 24) {
      flags.push({
        key: "shift-old",
        level: "warn",
        text: `وردية مفتوحة من ${hours} ساعة`,
      });
    }
  }

  // ------------------------------------------------------------
  // إشارات تشغيلية
  // ------------------------------------------------------------

  if (input.abandonedCarts7d >= 3) {
    flags.push({
      key: "abandoned",
      level: "warn",
      text: `${input.abandonedCarts7d} فاتورة اتفتحت واتسابت آخر أسبوع`,
    });
  }

  if (input.lowStockCount > 0) {
    flags.push({
      key: "low-stock",
      level: "info",
      text: `${input.lowStockCount} صنف وصل الحد الأدنى`,
    });
  }

  // الحد ده بيقف قدامه لما يحاول يضيف موظف، ومش بيبان قبلها -
  // فالأحسن نعرف إحنا قبل ما يتصل زعلان.
  if (input.staffLimit > 0 && input.employeeCount >= input.staffLimit) {
    flags.push({
      key: "staff-limit",
      level: "info",
      text: `وصل حد الموظفين (${input.employeeCount}/${input.staffLimit})`,
    });
  }

  return flags.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// رقم واحد للترتيب: المحل اللي فيه أخطر حاجة يطلع فوق، وعند
// التساوي اللي فيه تنبيهات أكتر.
export function healthScore(flags: HealthFlag[]): number {
  let score = 0;

  for (const flag of flags) {
    if (flag.level === "danger") score += 100;
    else if (flag.level === "warn") score += 10;
    else score += 1;
  }

  return score;
}

export function worstLevel(flags: HealthFlag[]): HealthLevel | null {
  if (flags.some((f) => f.level === "danger")) return "danger";
  if (flags.some((f) => f.level === "warn")) return "warn";
  if (flags.length > 0) return "info";

  return null;
}
