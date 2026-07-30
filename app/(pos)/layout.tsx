import { ReactNode } from "react";

export default function PosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <h1 className="text-lg font-bold">
          🐙 Octopus
        </h1>
      </header>

      <main className="p-4">
        {children}
      </main>

      {/* مساحة محجوزة لمساعد الأخطبوط الذكي - هتتفعل في مرحلة لاحقة */}
      <div className="fixed bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl shadow-lg">
        🐙
      </div>

    </div>
  );
}
