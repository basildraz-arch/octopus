import Link from "next/link";

export default function HomeMenu() {
  return (
    <div className="w-full max-w-md mx-auto p-6">

      <h1 className="text-5xl font-bold text-center">
        🐙 Octopus
      </h1>

      <p className="text-center text-gray-400 mt-3">
        إدارة مشروعك من مكان واحد
      </p>

      <div className="mt-10 space-y-4">

        <Link href="/sales">
          <button className="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold hover:bg-blue-700 transition">
            🛒 عملية بيع
          </button>
        </Link>

        <button className="w-full rounded-xl bg-gray-800 py-4 text-xl hover:bg-gray-700 transition">
          📦 المنتجات
        </button>

        <button className="w-full rounded-xl bg-gray-800 py-4 text-xl hover:bg-gray-700 transition">
          👥 العملاء
        </button>

        <button className="w-full rounded-xl bg-gray-800 py-4 text-xl hover:bg-gray-700 transition">
          📊 التقارير
        </button>

        <button className="w-full rounded-xl bg-gray-800 py-4 text-xl hover:bg-gray-700 transition">
          ⚙️ الإعدادات
        </button>

      </div>

    </div>
  );
}