"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCart, X } from "lucide-react";

import ItemList from "@/components/ItemList";
import Cart, { type CartItem } from "@/components/Cart";
import PriceTierPicker from "@/components/pos/PriceTierPicker";
import SalePopup from "@/components/SalePopup";
import Receipt from "@/components/Receipt";

import { getActiveItems } from "@/repositories/item.repository";
import { createSale } from "@/repositories/sale.repository";
import { setMascotMood } from "@/lib/mascotMood";
import { getBusiness } from "@/repositories/business.repository";
import { getCategories, type Category } from "@/repositories/category.repository";
import { logCartEvent } from "@/repositories/cartAudit.repository";
import {
  getCustomers,
  createCustomer,
} from "@/repositories/customer.repository";
import { useSession } from "@/hooks/useSession";
import { hasFeature } from "@/lib/features";
import { priceForTier, type PriceTier } from "@/lib/priceTier";
import { useWarehouseSelection } from "@/hooks/useWarehouseSelection";
import { useToast } from "@/hooks/useToast";

import type { Item } from "@/types/item";
import type { PaymentMethod } from "@/types/sale";
import type { Customer } from "@/types/customer";

type LastSale = {
  cart: CartItem[];
  total: number;
  discountAmount: number;
  createdAt: Date;
  // Frozen at checkout: the receipt must show the prices actually
  // charged, even if the cashier changes the selector afterwards.
  priceTier: PriceTier;
  // A quote is printed on demand and never prints itself; a real sale
  // prints automatically when the shop requires it.
  quote: boolean;
};

export default function SalesPage() {
  const { user, business } = useSession();
  const { warehouses, selectedWarehouseId, selectWarehouse } =
    useWarehouseSelection(user?.business_id);
  const toast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);

  // Phone only: the basket sheet. On a desktop the basket is always
  // the second column and this is never read.
  const [cartOpen, setCartOpen] = useState(false);

  const [showPopup, setShowPopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [priceTier, setPriceTier] = useState<PriceTier>(1);

  const tiersEnabled = hasFeature(business, "price_tiers");
  const creditEnabled = hasFeature(business, "credit_customers");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );

  // Ties every add/remove/checkout of ONE basket together in the audit
  // log. Lives in a ref, not state, so logging never triggers a
  // re-render of the till. Rotated after each completed sale so the
  // next customer is a new session.
  const cartSessionId = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    loadItems();
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!user) return;

    getBusiness(user.business_id).then((business) => {
      setMaxDiscountPercent(business?.max_discount_percent ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !creditEnabled) return;

    getCustomers(user.business_id).then(setCustomers);
  }, [user, creditEnabled]);

  async function addCustomerInline() {
    if (!user) return;

    const name = window.prompt("اسم العميل");

    if (!name?.trim()) return;

    const phone = window.prompt("رقم التليفون (اختياري)") ?? "";

    try {
      const customer = await createCustomer({
        businessId: user.business_id,
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      setCustomers((old) =>
        [...old, customer].sort((a, b) => a.name.localeCompare(b.name))
      );

      setSelectedCustomerId(customer.id);
      toast.success(`اتضاف ${customer.name}`);
    } catch (err) {
      console.error(err);
      toast.error("تعذر إضافة العميل");
    }
  }

  async function loadItems() {
    setLoading(true);

    const data = await getActiveItems();

    setItems(data);

    setLoading(false);
  }

  function changePriceTier(tier: PriceTier) {
    setPriceTier(tier);

    // Reprice whatever is already in the basket, otherwise the first
    // few lines would silently keep the previous customer's prices.
    setCart((oldCart) =>
      oldCart.map((line) => ({
        ...line,
        total: line.quantity * priceForTier(line.item, tier),
      }))
    );
  }

  function selectItem(item: Item) {
    setSelectedItem(item);
    setShowPopup(true);
  }

  function addToCart(quantity: number, total: number) {
    if (!selectedItem) return;

    const addedItem = selectedItem;

    setCart((oldCart) => {
      const index = oldCart.findIndex(
        (line) => line.item.id === addedItem.id
      );

      if (index === -1) {
        return [
          ...oldCart,
          {
            item: addedItem,
            quantity,
            total,
          },
        ];
      }

      const newCart = [...oldCart];

      newCart[index] = {
        ...newCart[index],
        quantity: newCart[index].quantity + quantity,
        total: newCart[index].total + total,
      };

      return newCart;
    });

    if (user) {
      // Not awaited: the till must stay responsive, and a failed log
      // line must never stop a sale.
      void logCartEvent({
        businessId: user.business_id,
        userId: user.id,
        cartSessionId: cartSessionId.current,
        action: "add",
        itemId: addedItem.id,
        itemName: addedItem.name,
        quantity,
        unitPrice: priceForTier(addedItem, priceTier),
        lineTotal: total,
      });
    }

    setSelectedItem(null);
    setShowPopup(false);
  }

  function deleteLine(id: string) {
    const removedLine = cart.find((line) => line.item.id === id);

    setCart((oldCart) =>
      oldCart.filter((line) => line.item.id !== id)
    );

    if (user && removedLine) {
      void logCartEvent({
        businessId: user.business_id,
        userId: user.id,
        cartSessionId: cartSessionId.current,
        action: "remove",
        itemId: removedLine.item.id,
        itemName: removedLine.item.name,
        quantity: removedLine.quantity,
        unitPrice: priceForTier(removedLine.item, priceTier),
        lineTotal: removedLine.total,
      });
    }
  }

  function printQuote() {
    if (!user || cart.length === 0) return;

    const subtotal = cart.reduce((sum, line) => sum + line.total, 0);

    void logCartEvent({
      businessId: user.business_id,
      userId: user.id,
      cartSessionId: cartSessionId.current,
      action: "quote",
      lineTotal: subtotal,
    });

    setLastSale({
      cart,
      total: subtotal,
      discountAmount: 0,
      createdAt: new Date(),
      priceTier,
      quote: true,
    });
  }

  async function checkout() {
    if (!user || cart.length === 0 || checkingOut || !selectedWarehouseId) return;

    const subtotal = cart.reduce(
      (sum, line) => sum + line.total,
      0
    );

    const discountValue = discountAmount === "" ? 0 : Number(discountAmount);

    if (discountValue > 0) {
      const maxAllowedDiscount =
        maxDiscountPercent != null
          ? (subtotal * maxDiscountPercent) / 100
          : 0;

      if (discountValue > maxAllowedDiscount) {
        toast.error(`أقصى خصم مسموح ${maxAllowedDiscount.toFixed(2)} جنيه`);
        return;
      }
    }

    if (paymentMethod === "credit" && !selectedCustomerId) {
      toast.error("اختار العميل الأول عشان تبيع على الحساب");
      return;
    }

    setCheckingOut(true);

    try {
      const sale = await createSale(
        user.business_id,
        user.id,
        cart,
        paymentMethod,
        discountValue,
        selectedWarehouseId,
        priceTier,
        paymentMethod === "credit" ? selectedCustomerId : null
      );

      // Closes the audit session: a cart with adds but no checkout is
      // what the owner's report flags as suspicious.
      void logCartEvent({
        businessId: user.business_id,
        userId: user.id,
        cartSessionId: cartSessionId.current,
        action: "checkout",
        lineTotal: subtotal - discountValue,
        saleId: sale?.id ?? null,
      });

      setLastSale({
        cart,
        total: subtotal - discountValue,
        discountAmount: discountValue,
        createdAt: new Date(),
        priceTier,
        quote: false,
      });

      setCart([]);
      setCartOpen(false);
      setPaymentMethod("cash");
      setDiscountAmount("");
      setSelectedCustomerId(null);

      // حبر بيفرح مع البيعة. مش زينة: الكاشير بيقف على الشاشة دي
      // اليوم كله، وحاجة صغيرة بتتفاعل معاه بتفرق.
      setMascotMood("happy", 2200);

      // Next customer, next session.
      cartSessionId.current = crypto.randomUUID();

      await loadItems();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إتمام البيع";

      toast.error(message);
      setMascotMood("surprised", 1800);
    } finally {
      setCheckingOut(false);
    }
  }

  const cartCount = cart.length;
  const cartTotal = cart.reduce((sum, line) => sum + line.total, 0);

  return (
    <>
      {/* pb-28 keeps the last row of items clear of the basket bar that
          floats over the bottom of the screen on a phone. */}
      <main className="min-h-screen bg-ink-950 pb-28 text-paper md:pb-0 print:hidden">
        <h1 className="mb-6 hidden items-center gap-2 text-3xl font-bold md:mb-8 md:flex md:text-4xl">
          <ShoppingCart size={28} />
          عملية بيع
        </h1>

        {/* Settings for the whole invoice, decided before the first
            item: which warehouse it comes out of and which price list
            it runs on. */}
        {(warehouses.length > 1 || (tiersEnabled && business)) && (
          <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-center">
            {warehouses.length > 1 && (
              <select
                value={selectedWarehouseId}
                onChange={(e) => selectWarehouse(e.target.value)}
                aria-label="البيع من مخزن"
                className="min-h-12 w-full rounded-xl border border-ink-600 bg-ink-800 px-3 text-paper outline-none md:max-w-xs"
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            )}

            {tiersEnabled && business && (
              <PriceTierPicker
                labels={business.price_tier_labels}
                selected={priceTier}
                onChange={changePriceTier}
              />
            )}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            جارِ تحميل الأصناف...
          </div>
        ) : (
          <div className="md:grid md:grid-cols-2 md:gap-8">
            <ItemList
              items={items}
              categories={categories}
              onSelect={selectItem}
              priceTier={priceTier}
            />

            {/* One basket, two shapes. On a phone it is a sheet that
                slides over the items when asked for; from md up it is
                simply the second column it always was. Rendering it
                once rather than twice keeps a single source of truth
                for what is in the basket. */}
            <div
              className={
                cartOpen
                  ? "fixed inset-0 z-50 flex flex-col justify-end md:static md:block"
                  : "hidden md:block"
              }
            >
              <div
                onClick={() => setCartOpen(false)}
                className="flex-1 bg-ink-950/80 md:hidden"
                aria-hidden
              />

              <div className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-ink-600 bg-ink-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-h-none md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:p-0">
                <div className="mb-3 flex items-center justify-between md:hidden">
                  <h2 className="text-lg font-bold text-paper">
                    السلة ({cartCount})
                  </h2>

                  <button
                    onClick={() => setCartOpen(false)}
                    aria-label="إغلاق السلة"
                    className="flex size-10 items-center justify-center rounded-full bg-ink-700 text-mist"
                  >
                    <X size={18} />
                  </button>
                </div>

                <Cart
                  cart={cart}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={setPaymentMethod}
                  maxDiscountPercent={maxDiscountPercent}
                  discountAmount={discountAmount}
                  onDiscountAmountChange={setDiscountAmount}
                  onDelete={deleteLine}
                  onCheckout={checkout}
                  onPrintQuote={printQuote}
                  credit={
                    creditEnabled
                      ? {
                          customers,
                          selectedCustomerId,
                          onSelectCustomer: setSelectedCustomerId,
                          onAddCustomer: addCustomerInline,
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        )}

        {showPopup && (
          <SalePopup
            item={selectedItem}
            onClose={() => setShowPopup(false)}
            onAdd={addToCart}
            priceTier={priceTier}
          />
        )}
      </main>

      {/* The running total, always within thumb reach, never covering
          the items it belongs to. Hidden the moment the basket is open
          so it cannot sit on top of the sheet. */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-center justify-between gap-3 border-t border-ink-600 bg-splash px-5 pb-[env(safe-area-inset-bottom)] text-ink-950 md:hidden print:hidden"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingCart size={20} />
            السلة ({cartCount})
          </span>

          <span className="text-lg font-bold">
            {cartTotal.toFixed(2)} ج
          </span>
        </button>
      )}

      {lastSale && (
        <Receipt
          cart={lastSale.cart}
          total={lastSale.total}
          discountAmount={lastSale.discountAmount}
          createdAt={lastSale.createdAt}
          onClose={() => setLastSale(null)}
          business={business}
          priceTier={lastSale.priceTier}
          quote={lastSale.quote}
          autoPrint={
            !lastSale.quote && (business?.force_print_on_sale ?? true)
          }
        />
      )}
    </>
  );
}
