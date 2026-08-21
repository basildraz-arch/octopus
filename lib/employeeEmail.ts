// Login identifiers for cashiers. These are NOT real mailboxes - an
// owner shouldn't have to create a Gmail account per employee - so
// they only need to be unique, short, and easy to remember and type.
//
// Shape: <username>@<business-code>.octopus.local
//   e.g.  mohamed@myshop.octopus.local
//
// The owner picks the username themselves (something they'll actually
// remember), and the business code is generated once per business and
// then frozen - so renaming the shop never breaks existing logins.
//
// Kept in one file (and one DOMAIN constant) on purpose: if Supabase
// Auth ever rejects this domain, it's a single-line change here
// rather than a hunt across the codebase.
export const EMPLOYEE_EMAIL_DOMAIN = "octopus.local";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Arabic has no written short vowels, so a letter-by-letter map gives
// the consonant skeleton: كيرو -> kyrw. Only used to SUGGEST a
// business code - the owner-typed username is never transliterated,
// because they type it in Latin themselves.
const ARABIC_MAP: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "e", "آ": "a", "ٱ": "a",
  "ب": "b", "ت": "t", "ث": "th", "ج": "g", "ح": "h",
  "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t",
  "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "k",
  "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h",
  "و": "w", "ي": "y", "ى": "a", "ة": "a", "ء": "",
  "ئ": "y", "ؤ": "w",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function transliterate(input: string): string {
  return input
    // strip Arabic diacritics (fatha/damma/kasra/shadda/sukun ...)
    .replace(/[ً-ْٰ]/g, "")
    .split("")
    .map((char) => {
      if (ARABIC_MAP[char] !== undefined) return ARABIC_MAP[char];
      if (/[a-zA-Z0-9]/.test(char)) return char.toLowerCase();
      return " ";
    })
    .join("");
}

export const BUSINESS_CODE_MIN_LENGTH = 2;
export const BUSINESS_CODE_MAX_LENGTH = 12;

// Only ever a SUGGESTION - the owner types the real one. Transliterating
// a whole Arabic shop name letter-by-letter produces unreadable soup
// ("بيزنس تجريبي" -> byznstgryby), so take just the first word and keep
// it short; anything longer is better typed by a human who knows what
// their shop is called.
export function suggestBusinessCode(
  businessName: string,
  attempt = 1
): string {
  const firstWord = transliterate(businessName).trim().split(/\s+/)[0] ?? "";

  const base = firstWord.replace(/[^a-z0-9]/g, "").slice(0, 8) || "shop";

  return attempt > 1 ? `${base}${attempt}` : base;
}

export function normalizeBusinessCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Returns an Arabic error message, or null when the code is fine.
export function validateBusinessCode(raw: string): string | null {
  const code = normalizeBusinessCode(raw);

  if (code.length === 0) {
    return "اكتب كود للمحل بالإنجليزي (حروف وأرقام بس)";
  }

  if (code.length < BUSINESS_CODE_MIN_LENGTH) {
    return `كود المحل لازم يكون ${BUSINESS_CODE_MIN_LENGTH} حروف على الأقل`;
  }

  if (code.length > BUSINESS_CODE_MAX_LENGTH) {
    return `كود المحل لازم يكون ${BUSINESS_CODE_MAX_LENGTH} حرف على الأكثر`;
  }

  if (/^[0-9]/.test(code)) {
    return "كود المحل لازم يبدأ بحرف مش رقم";
  }

  return null;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Returns an Arabic error message, or null when the username is fine.
export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);

  if (username.length === 0) {
    return "اكتب اسم دخول بالإنجليزي (حروف وأرقام بس)";
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return `اسم الدخول لازم يكون ${USERNAME_MIN_LENGTH} حروف على الأقل`;
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `اسم الدخول لازم يكون ${USERNAME_MAX_LENGTH} حرف على الأكثر`;
  }

  if (/^[0-9]+$/.test(username)) {
    return "اسم الدخول مينفعش يكون أرقام بس";
  }

  return null;
}

export function buildEmployeeEmail(
  username: string,
  businessCode: string
): string {
  return `${normalizeUsername(username)}@${businessCode}.${EMPLOYEE_EMAIL_DOMAIN}`;
}
