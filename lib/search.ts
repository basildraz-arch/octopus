import type { Item } from "@/types/item";

export function searchItems(
  items: Item[],
  search: string
) {
  const text = search.trim().toLowerCase();

  if (!text) return items;

  return items.filter((item) => {
    const nameMatch = item.name
      .toLowerCase()
      .includes(text);

    const keywordMatch = item.keywords.some((keyword) =>
      keyword.toLowerCase().includes(text)
    );

    return nameMatch || keywordMatch;
  });
}
