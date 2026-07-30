"use client";

import { useState } from "react";

import type { Item } from "@/types/item";
import { searchItems } from "@/lib/search";

type Props = {
  items: Item[];
  onSelect: (item: Item) => void;
};

export default function ItemList({
  items,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredItems = searchItems(items, search);

  return (
    <div>
      <h2 className="mb-4 text-2xl text-white">
        الأصناف
      </h2>

      <input
        type="text"
        placeholder="🔍 ابحث عن صنف..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-5 w-full rounded-xl bg-gray-800 p-4 text-white outline-none"
      />

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full rounded-xl bg-gray-800 p-4 text-right hover:bg-gray-700"
          >
            <div className="font-bold text-white">
              {item.name}
            </div>

            <div className="text-gray-400">
              {item.sell_price} جنيه / {item.unit}
            </div>
          </button>
        ))}

        {filteredItems.length === 0 && (
          <div className="rounded-xl bg-gray-800 p-4 text-center text-gray-400">
            لا توجد نتائج
          </div>
        )}
      </div>
    </div>
  );
}
