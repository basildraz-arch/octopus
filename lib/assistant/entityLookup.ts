import { normalize, NAV_TRIGGERS } from "@/lib/assistant/classify";
import { fuzzyIncludesAny } from "@/lib/assistant/fuzzyMatch";

export type EntityType = "item" | "warehouse";

export interface EntityLookupRequest {
  type: EntityType;
  nameQuery: string;
}

const ITEM_MARKERS = ["صنف", "منتج"];
const WAREHOUSE_MARKERS = ["مخزن"];

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

export function detectEntityLookup(
  question: string
): EntityLookupRequest | null {
  const text = normalize(question);

  if (!fuzzyIncludesAny(text, NAV_TRIGGERS)) {
    return null;
  }

  const itemQuery = extractAfterMarker(text, ITEM_MARKERS);
  if (itemQuery) {
    return { type: "item", nameQuery: itemQuery };
  }

  const warehouseQuery = extractAfterMarker(text, WAREHOUSE_MARKERS);
  if (warehouseQuery) {
    return { type: "warehouse", nameQuery: warehouseQuery };
  }

  return null;
}
