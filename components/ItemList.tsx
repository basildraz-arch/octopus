"use client";

import { useEffect, useState } from "react";

import type { Item } from "@/types/item";
import { searchItems } from "@/lib/search";

type Props = {
  items: Item[];
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
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    const supported =
      "SpeechRecognition" in window ||
      "webkitSpeechRecognition" in window;

    setVoiceSupported(supported);
  }, []);

  const filteredItems = searchItems(items, search);

  function startVoice() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      speak("قول اسم المنتج");
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setSearch(text);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl text-white">
        الأصناف
      </h2>

      <div className="mb-5 flex gap-2">
        <input
          type="text"
          placeholder="🔍 ابحث عن صنف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl bg-gray-800 p-4 text-white outline-none"
        />

        {voiceSupported && (
          <button
            onClick={startVoice}
            className={`shrink-0 rounded-xl px-5 text-xl transition ${
              listening
                ? "bg-red-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            🎤
          </button>
        )}
      </div>

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
