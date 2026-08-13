import { normalize, NAV_TRIGGERS } from "@/lib/assistant/classify";
import { fuzzyIncludesAny } from "@/lib/assistant/fuzzyMatch";

export type EntityType = "item" | "warehouse";

export interface EntityLookupRequest {
  type: EntityType | "unknown";
  nameQuery: string;
  strict: boolean;
}

const ITEM_MARKERS = ["صنف", "منتج"];
const WAREHOUSE_MARKERS = ["مخزن"];
const STOPWORDS = ["سعر", "كميه", "اسم", "تكلفه", "وحده"];

const GENERIC_NAV_WORDS = [
  "مخزون",
  "مخازن",
  "فئات",
  "تقارير",
  "تقرير",
  "مبيعات",
  "بيع",
  "اعدادات",
];

function extractAfterMarker(text: string, markers: string[]): string | null {
  for (const marker of markers) {
    const index = text.indexOf(marker);

    if (index !== -1) {
      const nameQuery = text.slice(index + marker.length).trim();

      if (nameQuery.length >= 2) {
        return nameQuery;
      }
    }
  }

  return null;
}

function findTriggerEnd(text: string): number | null {
  let bestIndex: number | null = null;
  let bestEnd: number | null = null;

  for (const trigger of NAV_TRIGGERS) {
    const index = text.indexOf(trigger);

    if (index !== -1 && (bestIndex === null || index < bestIndex)) {
      bestIndex = index;
      bestEnd = index + trigger.length;
    }
  }

  return bestEnd;
}

function stripStopwords(text: string): string {
  const words = text.split(" ").filter(Boolean);
  const filtered = words.filter((word) => !STOPWORDS.includes(word));

  return filtered.join(" ").trim();
}

export function detectEntityLookup(
  question: string
): EntityLookupRequest | null {
  const text = normalize(question);

  if (!fuzzyIncludesAny(text, NAV_TRIGGERS)) {
    return null;
  }

  const itemQuery = extractAfterMarker(text, ITEM_MARKERS);
  if (itemQuery) {
    return { type: "item", nameQuery: itemQuery, strict: true };
  }

  const warehouseQuery = extractAfterMarker(text, WAREHOUSE_MARKERS);
  if (warehouseQuery) {
    return { type: "warehouse", nameQuery: warehouseQuery, strict: true };
  }

  const triggerEnd = findTriggerEnd(text);
  if (triggerEnd === null) {
    return null;
  }

  const rawCandidate = text.slice(triggerEnd).trim();
  const cleaned = stripStopwords(rawCandidate);

  if (cleaned.length < 2) {
    return null;
  }

  if (fuzzyIncludesAny(cleaned, GENERIC_NAV_WORDS)) {
    return null;
  }

  return { type: "unknown", nameQuery: cleaned, strict: false };
}
