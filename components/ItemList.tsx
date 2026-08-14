"use client";

import { useEffect, useState } from "react";
import { Search, Mic } from "lucide-react";

import type { Item } from "@/types/item";
import type { Category } from "@/repositories/category.repository";
import { searchItems } from "@/lib/search";

type Props = {
  items: Item[];
  categories: Category[];
  onSelect: (item: Item) => void;
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
      <h2 className="mb-4 text-2xl text-paper">
        الأصناف
      </h2>

      <div className="mb-5 flex gap-2">
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
            className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 pr-11 text-paper outline-none"
          />
        </div>

        {voiceSupported && (
          <button
            onClick={startVoice}
            className={`shrink-0 rounded-xl px-5 transition ${
              listening
                ? "bg-red-600 text-white"
                : "bg-splash text-ink-950 hover:bg-splash-deep"
            }`}
          >
            <Mic size={20} />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              selectedCategoryId === null
                ? "bg-splash text-ink-950"
                : "bg-ink-700 text-mist hover:bg-ink-600"
            }`}
          >
            الكل
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedCategoryId === category.id
                  ? "bg-splash text-ink-950"
                  : "bg-ink-700 text-mist hover:bg-ink-600"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full rounded-xl border border-ink-600 bg-ink-800 p-4 text-right hover:bg-ink-700"
          >
            <div className="font-bold text-paper">
              {item.name}
            </div>

            <div className="text-mist">
              {item.sell_price} جنيه / {item.unit}
            </div>
          </button>
        ))}

        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center text-mist">
            لا توجد نتائج
          </div>
        )}
      </div>
    </div>
  );
}
