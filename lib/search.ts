import type { Product } from "@/data/products";

export function searchProducts(
  products: Product[],
  search: string
) {
  const text = search.trim().toLowerCase();

  if (!text) return products;

  return products.filter((product) => {
    const nameMatch = product.name
      .toLowerCase()
      .includes(text);

    const keywordMatch = product.keywords.some((keyword) =>
      keyword.toLowerCase().includes(text)
    );

    return nameMatch || keywordMatch;
  });
}