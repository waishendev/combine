"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CartSummary } from "@/components/shop/CartSummary";
import { useCart } from "@/hooks/useCart";
import { apiPost } from "@/lib/api";
import { getOrCreateSessionToken } from "@/lib/session-token";
import type { Cart, CartItem } from "@/lib/shop-types";

type CheckoutPreviewResponse = {
  data: {
    cart: Cart;
  };
};

type OrderResponse = {
  data: {
    order_no: string;
    payment?: {
      provider?: string;
      billplz_url?: string | null;
    } | null;
  };
};

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  postcode: "",
  city: "",
  state: "",
  country: "",
  payment_method: "manual_transfer",
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, reload } = useCart();
  const [form, setForm] = useState(initialForm);
  const [previewCart, setPreviewCart] = useState<Cart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());

  const sessionToken = getOrCreateSessionToken();

  // 从 URL 参数读取选中的项目
  useEffect(() => {
    const selectedParam = searchParams.get("selected");
    if (selectedParam) {
      const ids = selectedParam.split(",").map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
      setSelectedItemIds(new Set(ids));
    } else if (cart?.items) {
      // 如果没有指定，默认选中所有项目
      setSelectedItemIds(new Set(cart.items.map((item) => item.id)));
    }
  }, [searchParams, cart]);

  // 获取选中的购物车项目
  const getSelectedItems = (): CartItem[] => {
    if (!cart?.items) return [];
    return cart.items.filter((item) => selectedItemIds.has(item.id));
  };

  // 将选中的项目转换为 API 需要的格式
  const getItemsForAPI = (): Array<{ product_id: number; quantity: number }> => {
    return getSelectedItems().map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
  };

  function onChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handlePreview(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const items = getItemsForAPI();
      if (items.length === 0) {
        setMessage("Please select at least one item to checkout");
        return;
      }

      const res = await apiPost<CheckoutPreviewResponse>("/public/shop/checkout/preview", {
        items,
        session_token: sessionToken,
        shipping_method: "shipping", // 默认使用 shipping，可以根据表单调整
        ...form,
      });
      setPreviewCart(res.data.cart);
      await reload();
    } catch (error: any) {
      setMessage(error.message || "Unable to preview order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const items = getItemsForAPI();
      if (items.length === 0) {
        setMessage("Please select at least one item to checkout");
        return;
      }

      const res = await apiPost<OrderResponse>("/public/shop/orders", {
        items,
        session_token: sessionToken,
        payment_method: form.payment_method,
        shipping_method: "shipping", // 默认使用 shipping，可以根据表单调整
        shipping_name: form.name,
        shipping_phone: form.phone,
        shipping_address_line1: form.address,
        shipping_city: form.city,
        shipping_state: form.state,
        shipping_country: form.country,
        shipping_postcode: form.postcode,
      });

      const payment = res.data.payment;
      if (payment?.provider === "billplz" && payment.billplz_url) {
        window.location.href = payment.billplz_url;
        return;
      }

      router.push(`/orders/${res.data.order_no}/thank-you`);
    } catch (error: any) {
      setMessage(error.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm uppercase text-blue-700">Checkout</p>
        <h1 className="text-3xl font-semibold">Customer information</h1>
        <p className="text-sm text-slate-600">Provide contact, shipping, and payment method to complete your order.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6 rounded-xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" value={form.name} onChange={onChange} required />
            <Input label="Email" name="email" type="email" value={form.email} onChange={onChange} required />
            <Input label="Phone" name="phone" value={form.phone} onChange={onChange} required />
            <Input label="Address" name="address" value={form.address} onChange={onChange} className="sm:col-span-2" required />
            <Input label="Postcode" name="postcode" value={form.postcode} onChange={onChange} required />
            <Input label="City" name="city" value={form.city} onChange={onChange} required />
            <Input label="State" name="state" value={form.state} onChange={onChange} />
            <Input label="Country" name="country" value={form.country} onChange={onChange} />
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Payment method</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="payment_method"
                  value="manual_transfer"
                  checked={form.payment_method === "manual_transfer"}
                  onChange={onChange}
                />
                <div>
                  <p className="font-semibold">Manual transfer</p>
                  <p className="text-sm text-slate-600">Upload payment proof after submitting order.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="payment_method"
                  value="billplz_fpx"
                  checked={form.payment_method === "billplz_fpx"}
                  onChange={onChange}
                />
                <div>
                  <p className="font-semibold">Billplz FPX</p>
                  <p className="text-sm text-slate-600">We will redirect you to Billplz to complete the payment.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={submitting}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 disabled:cursor-not-allowed"
            >
              Preview totals
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Processing..." : "Confirm order"}
            </button>
            {message && <p className="text-sm text-red-600">{message}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <CartSummary cart={previewCart ?? cart ?? null} selectedItems={getSelectedItems()} />
          {previewCart && <p className="text-sm text-slate-600">Totals are based on the latest preview.</p>}
          {selectedItemIds.size > 0 && selectedItemIds.size < (cart?.items?.length ?? 0) && (
            <p className="text-sm text-blue-600">
              {selectedItemIds.size} of {cart?.items?.length ?? 0} items selected for checkout
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function Input({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm font-semibold text-slate-700 ${className ?? ""}`}>
      {label}
      <input
        {...props}
        className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
