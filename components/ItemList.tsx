"use client";

import { useEffect, useState } from "react";
import { Search, Mic } from "lucide-react";

import type { Item } from "@/types/item";
import type { Category } from "@/repositories/category.repository";
import { searchItems } from "@/lib/search";
import { priceForTier, type PriceTier } from "@/lib/priceTier";

type Props = {
  items: Item[];
  categories: Category[];
  onSelect: (item: Item) => void;
  // Which of the shop's price tiers the current invoice is using.
  priceTier?: PriceTier;
};

function speak(text: string) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ar-EG";
  msg.rate = 1;
  window.speechSynthesis.speak(msg);
}

export default function ItemList({
  items,
  categories,
  onSelect,
  priceTier = 1,
}: Props) {
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const supported =
      "SpeechRecognition" in window ||
      "webkitSpeechRecognition" in window;

    setVoiceSupported(supported);
  }, []);

  const categoryFilteredItems = selectedCategoryId
    ? items.filter((item) => item.category_id === selectedCategoryId)
    : items;

  const filteredItems = searchItems(categoryFilteredItems, search);

  function startVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("[voice] onstart");
      setListening(true);
      speak("قول اسم المنتج");
    };

    recognition.onresult = (event: any) => {
      console.log("[voice] onresult", event);
      console.log("[voice] results.length", event.results.length);
      const text = event.results[0][0].transcript;
      console.log("[voice] transcript:", text);
      setSearch(text);
    };

    recognition.onspeechstart = () => {
      console.log("[voice] onspeechstart (audio detected)");
    };

    recognition.onaudiostart = () => {
      console.log("[voice] onaudiostart (mic capture started)");
    };

    recognition.onerror = (event: any) => {
      console.log("[voice] onerror", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      console.log("[voice] onend");
      setListening(false);
    };

    recognition.start();
  }

  return (
    <div>
      {/* Search and categories stay put while the items scroll under
          them. On a phone the till is mostly "find the drink, tap it",
          and having to scroll back up to change category or type turns
          every order into two journeys. */}
      <div className="sticky top-0 z-20 -mx-4 bg-ink-950 px-4 pb-3 pt-1 md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0">
        <h2 className="mb-3 hidden text-2xl text-paper md:block">الأصناف</h2>

        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mist"
            />

            <input
              type="text"
              placeholder="ابحث عن صنف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-ink-600 bg-ink-800 p-4 pr-11 text-paper outline-none"
            />
          </div>

          {voiceSupported && (
            <button
              onClick={startVoice}
              aria-label="بحث بالصوت"
              className={`min-h-12 shrink-0 rounded-xl px-5 transition ${
                listening
                  ? "bg-red-600 text-white"
                  : "bg-splash text-ink-950 md:hover:bg-splash-deep"
              }`}
            >
              <Mic size={20} />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition ${
                selectedCategoryId === null
                  ? "bg-splash text-ink-950"
                  : "bg-ink-700 text-mist md:hover:bg-ink-600"
              }`}
            >
              الكل
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition ${
                  selectedCategoryId === category.id
                    ? "bg-splash text-ink-950"
                    : "bg-ink-700 text-mist md:hover:bg-ink-600"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Two per row rather than one full-width row each: a card wide
          enough for a thumb, and twice as many drinks visible without
          scrolling. */}
      <div className="grid grid-cols-2 gap-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex min-h-24 flex-col justify-between rounded-2xl border border-ink-600 bg-ink-800 p-3 text-right active:border-splash active:bg-ink-700 md:hover:border-splash md:hover:bg-ink-700"
          >
            <div className="line-clamp-2 font-bold leading-snug text-paper">
              {item.name}
            </div>

            <div className="mt-2">
              <span className="text-lg font-bold text-splash">
                {priceForTier(item, priceTier)}
              </span>
              <span className="text-xs text-mist"> ج / {item.unit}</span>
            </div>
          </button>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-2 rounded-xl border border-ink-600 bg-ink-800 p-6 text-center text-mist">
            لا توجد نتائج
          </div>
        )}
      </div>
    </div>
  );
}
