"use client";

import { useState } from "react";
import { products, type Product } from "@/data/products";

import ProductList from "@/components/ProductList";
import Cart, { type CartItem } from "@/components/Cart";
import SalePopup from "@/components/SalePopup";

export default function SalesPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setShowPopup(true);
  }

  function addToCart(quantity: number, total: number) {
    if (!selectedProduct) return;

    setCart((oldCart) => {
      const index = oldCart.findIndex(
        (item) => item.product.id === selectedProduct.id
      );

      if (index === -1) {
        return [
          ...oldCart,
          {
            product: selectedProduct,
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

    setSelectedProduct(null);
    setShowPopup(false);
  }

  function deleteItem(id: number) {
    setCart((oldCart) =>
      oldCart.filter((item) => item.product.id !== id)
    );
  }

  function checkout() {
    alert("✅ تم إنهاء الفاتورة");

    setCart([]);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-4xl font-bold mb-8">
        🛒 عملية بيع
      </h1>

      <div className="grid grid-cols-2 gap-8">
        <ProductList
          products={products}
          onSelect={selectProduct}
        />

        <Cart
          cart={cart}
          onDelete={deleteItem}
          onCheckout={checkout}
        />
      </div>

      {showPopup && (
        <SalePopup
          product={selectedProduct}
          onClose={() => setShowPopup(false)}
          onAdd={addToCart}
        />
      )}
    </main>
  );
}
