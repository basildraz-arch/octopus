"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const PRINT_ROOT_ID = "octopus-print-root";

// ============================================================
// ليه الفاتورة بتتنقل لآخر الصفحة قبل ما تتطبع
// ============================================================
//
// نظام الطباعة العام (`app/globals.css`) بيخفي الصفحة كلها
// بـ`visibility: hidden` وبيرجّع يظهر `[data-print-area]` بس، وبيحطه
// `position: absolute; top: 0` عشان ياخد أول الورقة.
//
// ده بيشتغل مع شاشة زي التقارير - الـ`<main>` بتاعها جزء من تخطيط
// الصفحة. **وبيفشل مع الفاتورة**، وde السبب الحقيقي في الورقة
// البيضا اللي كيرو اشتكى منها مرتين:
//
// الفاتورة modal جوه شاشة البيع. لما تبقى `position: absolute` بتخرج
// من التخطيط خالص، فالحاوية اللي شايلاها بيبقى ارتفاعها صفر. والورق
// الحراري مقاسه `auto` - يعني ارتفاع الصفحة بيتحسب من المحتوى.
// محتوى بارتفاع صفر = **ورقة فاضية**، والفاتورة بتتقص بره حدود
// الصفحة.
//
// والحل مش تظبيط الأرقام - الحل إن الفاتورة تخرج من شجرة الشاشة
// خالص وتبقى ابن مباشر لـ`<body>`. ساعتها الطباعة بتبقى:
//
//     خبّي كل أولاد body ما عدا البوابة دي   ← display: none
//
// مفيش `visibility` ولا `absolute` ولا بقايا تخطيط من شاشة البيع.
// الفاتورة بتبقى المحتوى الوحيد على الورقة وبترسم نفسها عادي.
//
// `display: none` هنا آمن (وهو ممنوع في النظام العام) لأن اللي
// بيتخفي إخوة مش أجداد - مفيش حاجة جوه الفاتورة بتتأثر.
export default function PrintPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let node = document.getElementById(PRINT_ROOT_ID);

    if (!node) {
      node = document.createElement("div");
      node.id = PRINT_ROOT_ID;
      document.body.appendChild(node);
    }

    setHost(node);

    // البوابة بتفضل في الصفحة فاضية بعد ما الفاتورة تتقفل.
    // مابنشيلهاش عن قصد: قاعدة الطباعة بتشترط إن جواها
    // `[data-print-area]` فعلًا، فالبوابة الفاضية مالهاش أي أثر،
    // وشيلها وقت الـunmount بيدخلنا في سباق مع React وهو بيفضي
    // أولادها.
  }, []);

  if (!host) return null;

  return createPortal(children, host);
}
