"use client";

import { useEffect, useState } from "react";

import ItemList from "@/components/ItemList";
import Cart, { type CartItem } from "@/components/Cart";
import SalePopup from "@/components/SalePopup";
import Receipt from "@/components/Receipt";

import { getActiveItems } from "@/repositories/item.repository";
import { createSale } from "@/repositories/sale.repository";
import { getBusiness } from "@/repositories/business.repository";
import { getCategories, type Category } from "@/repositories/category.repository";
import { useSession } from "@/hooks/useSession";
import { useWarehouseSelection } from "@/hooks/useWarehouseSelection";

import type { Item } from "@/types/item";
import type { PaymentMethod } from "@/types/sale";

type LastSale = {
  cart: CartItem[];
  total: number;
  discountAmount: number;
  createdAt: Date;
};

export default function SalesPage() {
  const { user } = useSession();
  const { warehouses, selectedWarehouseId, selectWarehouse } =
    useWarehouseSelection(user?.business_id);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [maxDiscountPercent, setMaxDiscountPercent] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");

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

  async function loadItems() {
    setLoading(true);

    const data = await getActiveItems();

    setItems(data);

    setLoading(false);
  }

  function selectItem(item: Item) {
    setSelectedItem(item);
    setShowPopup(true);
  }

  function addToCart(quantity: number, total: number) {
    if (!selectedItem) return;

    setCart((oldCart) => {
      const index = oldCart.findIndex(
        (line) => line.item.id === selectedItem.id
      );

      if (index === -1) {
        return [
          ...oldCart,
          {
            item: selectedItem,
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

    setSelectedItem(null);
    setShowPopup(false);
  }

  function deleteLine(id: string) {
    setCart((oldCart) =>
      oldCart.filter((line) => line.item.id !== id)
    );
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
        alert(`أقصى خصم مسموح ${maxAllowedDiscount.toFixed(2)} جنيه`);
        return;
      }
    }

    setCheckingOut(true);

    try {
      await createSale(
        user.business_id,
        user.id,
        cart,
        paymentMethod,
        discountValue,
        selectedWarehouseId
      );

      setLastSale({
        cart,
        total: subtotal - discountValue,
        discountAmount: discountValue,
        createdAt: new Date(),
      });

      setCart([]);
      setPaymentMethod("cash");
      setDiscountAmount("");
      await loadItems();
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إتمام البيع";

      alert(message);
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-gray-950 p-4 text-white md:p-6 print:hidden">
        <h1 className="mb-6 text-3xl font-bold md:mb-8 md:text-4xl">
          🛒 عملية بيع
        </h1>

        {warehouses.length > 1 && (
          <div className="mb-6">
            <label className="mb-1 block text-sm text-gray-400">
              البيع من مخزن
            </label>

            <select
              value={selectedWarehouseId}
              onChange={(e) => selectWarehouse(e.target.value)}
              className="w-full max-w-xs rounded-xl bg-gray-800 p-3 text-white outline-none"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            جارِ تحميل الأصناف...
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <ItemList
              items={items}
              categories={categories}
              onSelect={selectItem}
            />

            <Cart
              cart={cart}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              maxDiscountPercent={maxDiscountPercent}
              discountAmount={discountAmount}
              onDiscountAmountChange={setDiscountAmount}
              onDelete={deleteLine}
              onCheckout={checkout}
            />
          </div>
        )}

        {showPopup && (
          <SalePopup
            item={selectedItem}
            onClose={() => setShowPopup(false)}
            onAdd={addToCart}
          />
        )}
      </main>

      {lastSale && (
        <Receipt
          cart={lastSale.cart}
          total={lastSale.total}
          discountAmount={lastSale.discountAmount}
          createdAt={lastSale.createdAt}
          onClose={() => setLastSale(null)}
        />
      )}
    </>
  );
}
