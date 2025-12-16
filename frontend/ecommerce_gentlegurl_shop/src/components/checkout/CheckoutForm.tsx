"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import {
  CheckoutPayload,
  PublicBankAccount,
  PublicStoreLocation,
  createOrder,
  getBankAccounts,
  getStoreLocations,
} from "@/lib/apiClient";

export default function CheckoutForm() {
  const router = useRouter();
  const { customer } = useAuth();
  const addresses = customer?.addresses ?? [];

  const {
    selectedItems,
    sessionToken,
    shippingMethod,
    setShippingMethod,
    totals,
    applyVoucher,
    voucherError,
    voucherMessage,
    isApplyingVoucher,
    appliedVoucher,
    shippingLabel,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<
    "manual_transfer" | "billplz_fpx"
  >("manual_transfer");
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [bankAccounts, setBankAccounts] = useState<PublicBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [storeLocations, setStoreLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | "custom" | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [modalAddress, setModalAddress] = useState({
    name: customer?.profile.name ?? "",
    phone: customer?.profile.phone ?? "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    country: "Malaysia",
    postcode: "",
  });

  const [form, setForm] = useState({
    shipping_name: customer?.profile.name ?? "",
    shipping_phone: customer?.profile.phone ?? "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "Malaysia",
    shipping_postcode: "",
  });

  const setFormFromAddress = (address: {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    country?: string;
    postcode?: string | null;
  }) => {
    setForm({
      shipping_name: address.name,
      shipping_phone: address.phone ?? "",
      shipping_address_line1: address.line1,
      shipping_address_line2: address.line2 ?? "",
      shipping_city: address.city,
      shipping_state: address.state ?? "",
      shipping_country: address.country ?? "Malaysia",
      shipping_postcode: address.postcode ?? "",
    });
  };

  useEffect(() => {
    getBankAccounts()
      .then((accounts) => {
        setBankAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedBankId(accounts.find((bank) => bank.is_default)?.id ?? accounts[0].id);
        }
      })
      .catch(() => setBankAccounts([]));
  }, []);

  useEffect(() => {
    getStoreLocations()
      .then((locations) => {
        setStoreLocations(locations);
        if (locations.length > 0) {
          setSelectedStoreId((prev) => prev ?? locations[0].id);
        }
      })
      .catch(() => setStoreLocations([]));
  }, []);

  useEffect(() => {
    if (addresses.length > 0 && selectedAddressId !== "custom") {
      const defaultAddress =
        addresses.find((addr) => addr.id === selectedAddressId) ??
        addresses.find((addr) => addr.is_default) ??
        addresses[0];

      if (defaultAddress) {
        setSelectedAddressId((prev) => prev ?? defaultAddress.id);
        setFormFromAddress({
          name: defaultAddress.name,
          phone: defaultAddress.phone,
          line1: defaultAddress.line1,
          line2: defaultAddress.line2,
          city: defaultAddress.city,
          state: defaultAddress.state,
          country: defaultAddress.country,
          postcode: defaultAddress.postcode,
        });
      }
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!addresses.length && customer) {
      setForm((prev) => ({
        ...prev,
        shipping_name: prev.shipping_name || customer.profile.name,
        shipping_phone: prev.shipping_phone || customer.profile.phone,
      }));
    }
  }, [addresses.length, customer]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyVoucher = async () => {
    await applyVoucher(voucherCode.trim() || undefined);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItems || selectedItems.length === 0) {
      setError("Please select at least one item in your cart.");
      return;
    }

    if (paymentMethod === "manual_transfer" && !selectedBankId) {
      setError("Please choose a bank account for manual transfer.");
      return;
    }

    if (shippingMethod === "pickup" && !selectedStoreId) {
      setError("Please choose a store location for self pickup.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CheckoutPayload = {
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        session_token: sessionToken ?? undefined,
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        ...form,
        store_location_id: shippingMethod === "pickup" ? selectedStoreId ?? undefined : undefined,
        bank_account_id: paymentMethod === "manual_transfer" ? selectedBankId ?? undefined : undefined,
      };

      const order = await createOrder(payload);

      if (order.payment_method === "billplz_fpx" && order.payment?.billplz_url) {
        window.location.href = order.payment.billplz_url!;
        return;
      }

      const query = new URLSearchParams({
        order_no: order.order_no,
        order_id: String(order.order_id),
        payment_method: order.payment_method,
      }).toString();

      router.push(`/thank-you?${query}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create order.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBank = useMemo(
    () => bankAccounts.find((bank) => bank.id === selectedBankId) ?? bankAccounts[0],
    [bankAccounts, selectedBankId],
  );

  if (!selectedItems || selectedItems.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-[var(--foreground)]">
        <h1 className="mb-4 text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-[var(--foreground)]/70">
          Your cart is empty. Please add items before checking out.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 md:grid-cols-[2fr,1fr]">
        {/* 左侧：Shipping 信息 */}
        <div className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Contact & Address</h2>
            {customer && (
              <button
                type="button"
                onClick={() => {
                  setModalAddress({
                    name: form.shipping_name,
                    phone: form.shipping_phone,
                    line1: form.shipping_address_line1,
                    line2: form.shipping_address_line2,
                    city: form.shipping_city,
                    state: form.shipping_state,
                    country: form.shipping_country,
                    postcode: form.shipping_postcode,
                  });
                  setShowAddressModal(true);
                }}
                className="rounded border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--muted)]/70"
              >
                Add Address
              </button>
            )}
          </div>

          {customer && addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className="flex cursor-pointer gap-3 rounded border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-3 hover:border-[var(--accent)]/60"
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddressId === address.id}
                    onChange={() => {
                      setSelectedAddressId(address.id);
                      setFormFromAddress({
                        name: address.name,
                        phone: address.phone,
                        line1: address.line1,
                        line2: address.line2,
                        city: address.city,
                        state: address.state,
                        country: address.country,
                        postcode: address.postcode,
                      });
                    }}
                  />
                  <div className="text-sm text-[var(--foreground)]">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{address.name}</p>
                      {address.is_default && (
                        <span className="rounded bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] uppercase text-[var(--accent)]">Default</span>
                      )}
                    </div>
                    <p className="text-[var(--foreground)]/70">{address.phone}</p>
                    <p className="text-[var(--foreground)]/70">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className="text-[var(--foreground)]/70">
                      {[address.city, address.state, address.postcode].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-[var(--foreground)]/70">{address.country}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {!addresses.length && customer && (
            <p className="text-xs text-[var(--foreground)]/70">No saved addresses. Add one to use for this order.</p>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Full Name
                </label>
                <input
                  required
                  value={form.shipping_name}
                  onChange={(e) => handleChange("shipping_name", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Phone Number
                </label>
                <input
                  required
                  value={form.shipping_phone}
                  onChange={(e) => handleChange("shipping_phone", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Address Line 1
                </label>
                <input
                  required={shippingMethod === "shipping"}
                  value={form.shipping_address_line1}
                  onChange={(e) => handleChange("shipping_address_line1", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                  Address Line 2 (Optional)
                </label>
                <input
                  value={form.shipping_address_line2}
                  onChange={(e) => handleChange("shipping_address_line2", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                <input
                  required={shippingMethod === "shipping"}
                  value={form.shipping_city}
                  onChange={(e) => handleChange("shipping_city", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                <input
                  required={shippingMethod === "shipping"}
                  value={form.shipping_state}
                  onChange={(e) => handleChange("shipping_state", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                <input
                  required={shippingMethod === "shipping"}
                  value={form.shipping_country}
                  onChange={(e) => handleChange("shipping_country", e.target.value)}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
              <input
                required={shippingMethod === "shipping"}
                value={form.shipping_postcode}
                onChange={(e) => handleChange("shipping_postcode", e.target.value)}
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* 右侧：Shipping & Payment + 下单按钮 */}
        <aside className="space-y-4 rounded-lg border border-[var(--muted)] bg-white/80 p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">
              Shipping Method
            </div>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping_method"
                  value="shipping"
                  checked={shippingMethod === "shipping"}
                  onChange={() => setShippingMethod("shipping")}
                />
                <span>Shipping ({shippingLabel ?? "Flat Rate"})</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping_method"
                  value="pickup"
                  checked={shippingMethod === "pickup"}
                  onChange={() => setShippingMethod("pickup")}
                />
                <span>Self Pickup (RM 0)</span>
              </label>
            </div>
          </div>

          {shippingMethod === "pickup" && (
            <div className="rounded border border-[var(--muted)]/60 bg-[var(--muted)]/20 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">Choose Store Location</div>
              {storeLocations.length === 0 && (
                <p className="text-xs text-[var(--foreground)]/70">No active store locations available.</p>
              )}
              <div className="space-y-2">
                {storeLocations.map((store) => (
                  <label
                    key={store.id}
                    className="flex cursor-pointer gap-2 rounded border border-transparent p-2 hover:border-[var(--accent)]/60"
                  >
                    <input
                      type="radio"
                      name="store_location"
                      value={store.id}
                      checked={selectedStoreId === store.id}
                      onChange={() => setSelectedStoreId(store.id)}
                    />
                    <div className="text-xs text-[var(--foreground)]">
                      <div className="font-semibold">{store.name}</div>
                      <div className="text-[var(--foreground)]/70">{store.phone}</div>
                      <div className="text-[var(--foreground)]/70">
                        {store.address_line1}
                        {store.address_line2 ? `, ${store.address_line2}` : ""}
                      </div>
                      <div className="text-[var(--foreground)]/70">
                        {[store.city, store.state, store.postcode].filter(Boolean).join(", ")}
                      </div>
                      <div className="text-[var(--foreground)]/70">{store.country}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">Voucher</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Enter voucher"
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                disabled={isApplyingVoucher || !voucherCode.trim()}
                className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply"}
              </button>
            </div>
            {appliedVoucher && (
              <p className="mt-1 text-xs text-[var(--foreground)]/70">
                Voucher {appliedVoucher.code} applied.
              </p>
            )}
            {voucherMessage && !appliedVoucher && (
              <p className="mt-1 text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
            )}
            {voucherError && <p className="mt-1 text-xs text-[#c26686]">{voucherError}</p>}
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">
              Payment Method
            </div>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_method"
                  value="manual_transfer"
                  checked={paymentMethod === "manual_transfer"}
                  onChange={() => setPaymentMethod("manual_transfer")}
                />
                <span>Manual Bank Transfer</span>
              </label>
              {paymentMethod === "manual_transfer" && bankAccounts.length > 0 && (
                <div className="rounded border border-[var(--muted)]/70 bg-[var(--muted)]/20 p-3 text-xs text-[var(--foreground)]">
                  <p className="mb-2 font-medium text-[var(--foreground)]">Choose Bank</p>
                  <div className="space-y-2">
                    {bankAccounts.map((bank) => (
                      <label key={bank.id} className="flex items-start gap-2 rounded border border-transparent p-2 hover:border-[var(--accent)]/60">
                        <input
                          type="radio"
                          name="bank_account"
                          value={bank.id}
                          checked={(selectedBank?.id ?? bankAccounts[0]?.id) === bank.id}
                          onChange={() => setSelectedBankId(bank.id)}
                        />
                        <div>
                          <div className="font-semibold">{bank.bank_name}</div>
                          <div className="text-[var(--foreground)]/70">{bank.account_name}</div>
                          <div className="text-[var(--foreground)]/70">{bank.account_no}</div>
                          {bank.branch && (
                            <div className="text-[var(--foreground)]/60">Branch: {bank.branch}</div>
                          )}
                          {bank.qr_image_url && (
                            <img
                              src={bank.qr_image_url}
                              alt={`${bank.bank_name} QR`}
                              className="mt-2 h-20 w-20 rounded border border-[var(--muted)] object-contain"
                            />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {paymentMethod === "manual_transfer" && bankAccounts.length === 0 && (
                <p className="text-xs text-[var(--foreground)]/70">
                  Bank transfer details will be provided after placing the order.
                </p>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_method"
                  value="billplz_fpx"
                  checked={paymentMethod === "billplz_fpx"}
                  onChange={() => setPaymentMethod("billplz_fpx")}
                />
                <span>Online Banking (Billplz FPX)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[#b8527a]">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            <p className="text-xs font-medium text-[var(--foreground)]/70">Items in this order:</p>
            <ul className="max-h-32 overflow-auto text-xs text-[var(--foreground)]">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="line-clamp-1">{item.name}</span>
                  <span className="ml-2">
                    x{item.quantity} (RM {Number(item.line_total).toFixed(2)})
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>RM {Number(totals.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>- RM {Number(totals.discount_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{shippingMethod === "shipping" ? shippingLabel ?? "Shipping" : "Self Pickup"}</span>
              <span>RM {Number(totals.shipping_fee).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-2 flex justify-between border-t pt-3 text-sm font-semibold">
            <span>To Pay</span>
            <span>RM {Number(totals.grand_total).toFixed(2)}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </form>

      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 text-[var(--foreground)] shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Address</h3>
              <button onClick={() => setShowAddressModal(false)} className="text-sm text-[var(--foreground)]/70">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Full Name</label>
                  <input
                    value={modalAddress.name}
                    onChange={(e) => setModalAddress({ ...modalAddress, name: e.target.value })}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone</label>
                  <input
                    value={modalAddress.phone}
                    onChange={(e) => setModalAddress({ ...modalAddress, phone: e.target.value })}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 1</label>
                <input
                  value={modalAddress.line1}
                  onChange={(e) => setModalAddress({ ...modalAddress, line1: e.target.value })}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2</label>
                <input
                  value={modalAddress.line2}
                  onChange={(e) => setModalAddress({ ...modalAddress, line2: e.target.value })}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                  <input
                    value={modalAddress.city}
                    onChange={(e) => setModalAddress({ ...modalAddress, city: e.target.value })}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                  <input
                    value={modalAddress.state}
                    onChange={(e) => setModalAddress({ ...modalAddress, state: e.target.value })}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                  <input
                    value={modalAddress.postcode}
                    onChange={(e) => setModalAddress({ ...modalAddress, postcode: e.target.value })}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                <input
                  value={modalAddress.country}
                  onChange={(e) => setModalAddress({ ...modalAddress, country: e.target.value })}
                  className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="rounded border border-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormFromAddress({
                    name: modalAddress.name,
                    phone: modalAddress.phone,
                    line1: modalAddress.line1,
                    line2: modalAddress.line2,
                    city: modalAddress.city,
                    state: modalAddress.state,
                    country: modalAddress.country,
                    postcode: modalAddress.postcode,
                  });
                  setSelectedAddressId("custom");
                  setShowAddressModal(false);
                }}
                className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
              >
                Use this address
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
