"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CartItem } from "@/components/Cart";
import {
  MAX_TICKETS,
  newTicketId,
  nextTicketName,
  readTickets,
  writeTickets,
  type Ticket,
} from "@/lib/parkedCarts";

// عربيات متعددة محفوظة، بواجهة `useState` بالظبط.
//
// `cart` و`setCart` الراجعين من هنا ليهم **نفس توقيع**
// `useState<CartItem[]>` - بيقبلوا قيمة أو دالة تحديث. وde مقصود:
// شاشة البيع كانت بتستعملهم في خمس أماكن، والتغيير الوحيد اللي
// احتاجته هو سطر التعريف. كود البيع نفسه مالوش دعوة إن العربية بقت
// محفوظة ولا إن فيه غيرها.
export function useCarts(businessId: string | null) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // القراءة من التخزين بتحصل **بعد** أول رسم مش وقته: السيرفر
  // مايعرفش localStorage، ولو رسمنا بمحتواه من أول لحظة، اللي
  // المتصفح يرسمه هيبقى مختلف عن اللي السيرفر بعته (hydration
  // mismatch).
  const loaded = useRef(false);

  useEffect(() => {
    if (!businessId || loaded.current) return;

    const stored = readTickets(businessId);

    setTickets(stored.tickets);
    setActiveId(stored.activeId);

    loaded.current = true;
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !loaded.current) return;

    writeTickets(businessId, tickets, activeId);
  }, [businessId, tickets, activeId]);

  const active = tickets.find((t) => t.id === activeId) ?? null;
  const cart = active?.cart ?? [];

  // ============================================================
  // ليه الـid بيتولد بره الـupdater
  // ============================================================
  //
  // React في وضع التطوير (StrictMode) بينادي دالة التحديث **مرتين**
  // عشان يكشف الدوال اللي ليها أثر جانبي. لو `newTicketId()` أو
  // `setActiveId()` كانوا جوه، كل مرة كانت هتولّد id مختلف، والحالة
  // اللي هتتسجّل ممكن تبقى مش نفس اللي الـid اتسمّى بيه.
  //
  // فالـid والاسم بيتحسبوا مرة واحدة هنا، والـupdater بيضيف بس.

  const setCart = useCallback(
    (next: CartItem[] | ((current: CartItem[]) => CartItem[])) => {
      // أول صنف بيتحط ومفيش فاتورة مفتوحة: بنعمل واحدة على طول بدل
      // ما نطلب من الكاشير يدوس "فاتورة جديدة" الأول. الحالة
      // الشايعة لازم تبقى صفر دوسات.
      if (!activeId) {
        const id = newTicketId();
        const name = nextTicketName(tickets);
        const cartValue = typeof next === "function" ? next([]) : next;

        setTickets((current) => [
          ...current,
          { id, name, cart: cartValue, createdAt: Date.now() },
        ]);

        setActiveId(id);

        return;
      }

      setTickets((current) =>
        current.map((t) =>
          t.id === activeId
            ? { ...t, cart: typeof next === "function" ? next(t.cart) : next }
            : t
        )
      );
    },
    [activeId, tickets]
  );

  const openTicket = useCallback(() => {
    if (tickets.length >= MAX_TICKETS) return;

    const id = newTicketId();
    const name = nextTicketName(tickets);

    setTickets((current) =>
      current.length >= MAX_TICKETS
        ? current
        : [...current, { id, name, cart: [], createdAt: Date.now() }]
    );

    setActiveId(id);
  }, [tickets]);

  const closeTicket = useCallback(
    (id: string) => {
      setTickets((current) => current.filter((t) => t.id !== id));

      if (activeId === id) {
        setActiveId(tickets.find((t) => t.id !== id)?.id ?? null);
      }
    },
    [activeId, tickets]
  );

  const renameTicket = useCallback((id: string, name: string) => {
    const clean = name.trim().slice(0, 20);

    if (!clean) return;

    setTickets((current) =>
      current.map((t) => (t.id === id ? { ...t, name: clean } : t))
    );
  }, []);

  // بعد الدفع: الفاتورة دي خلصت وبتتشال، مش بتتفضّى.
  const clearActive = useCallback(() => {
    const id = activeId;

    setTickets((current) => current.filter((t) => t.id !== id));
    setActiveId(tickets.find((t) => t.id !== id)?.id ?? null);
  }, [activeId, tickets]);

  return {
    cart,
    setCart,
    tickets,
    activeId,
    switchTo: setActiveId,
    openTicket,
    closeTicket,
    renameTicket,
    clearActive,
    canOpenMore: tickets.length < MAX_TICKETS,
  };
}
