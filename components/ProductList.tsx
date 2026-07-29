"use client";

import { useState } from "react";

import type { Product } from "@/data/products";
import { searchProducts } from "@/lib/search";

type Props = {
  products: Product[];
  onSelect: (product: Product) => void;
};

export default function ProductList({
  products,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredProducts = searchProducts(products, search);

  return (
    <div>
      <h2 className="text-2xl mb-4">
        المنتجات
      </h2>

      <input
        type="text"
        placeholder="🔍 ابحث عن منتج..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl bg-gray-800 p-4 mb-5 outline-none"
      />

      <div className="space-y-3">
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            className="w-full rounded-xl bg-gray-800 p-4 text-right hover:bg-gray-700"
          >
            <div className="font-bold">
              {product.name}
            </div>

            <div className="text-gray-400">
              {product.price} جنيه / {product.unit}
            </div>
          </button>
        ))}

        {filteredProducts.length === 0 && (
          <div className="rounded-xl bg-gray-800 p-4 text-center text-gray-400">
            لا توجد نتائج
          </div>
        )}
      </div>
    </div>
  );
}