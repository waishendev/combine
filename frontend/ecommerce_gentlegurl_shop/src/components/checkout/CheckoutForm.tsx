"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import LoadingOverlay from "@/components/LoadingOverlay";
import {
  AddressPayload,
  CheckoutPayload,
  CustomerAddress,
  PublicBankAccount,
  PublicStoreLocation,
  createCustomerAddress,
  createOrder,
  deleteCustomerAddress,
  getCustomerAddresses,
  getBankAccounts,
  getStoreLocations,
  makeDefaultCustomerAddress,
  updateCustomerAddress,
} from "@/lib/apiClient";

export default function CheckoutForm() {
  const router = useRouter();
  const { customer } = useAuth();

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
    reloadCart,
    clearSelection,
    removeVoucher,
    clearVoucherFeedback,
    shippingFlatFee,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"manual_transfer" | "billplz_fpx" | "billplz_card">("manual_transfer");
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [bankAccounts, setBankAccounts] = useState<PublicBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [storeLocations, setStoreLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [tempSelectedAddressId, setTempSelectedAddressId] = useState<number | null>(null);
  const isLoggedIn = !!customer;
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(isLoggedIn); // Initialize as true if logged in
  const [isConfirmingAddress, setIsConfirmingAddress] = useState(false);
  const [isLoadingStoreLocations, setIsLoadingStoreLocations] = useState(true);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [addressMode, setAddressMode] = useState<"list" | "form">("list");
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressForm, setAddressForm] = useState<AddressPayload>({
    label: "",
    type: "shipping",
    name: customer?.profile.name ?? "",
    phone: customer?.profile.phone ?? "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    country: "Malaysia",
    postcode: "",
    is_default: false,
  });

  const [form, setForm] = useState({
    shipping_name: "",
    shipping_phone: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "Malaysia",
    shipping_postcode: "",
  });

  const isSelfPickup = shippingMethod === "self_pickup";

  const safeTotals = useMemo(() => {
    const subtotal = Number(totals.subtotal ?? 0);
    const discount = Number(totals.discount_total ?? 0);
    const shipping = isSelfPickup ? 0 : Number(totals.shipping_fee ?? shippingFlatFee ?? 0);
    const computedGrand = subtotal - discount + shipping;
    const rawGrand = Number(totals.grand_total ?? computedGrand);
    const grand = isSelfPickup ? computedGrand : rawGrand;

    return { subtotal, discount, shipping, grand };
  }, [totals.discount_total, totals.grand_total, totals.shipping_fee, totals.subtotal, isSelfPickup, shippingFlatFee]);

  const fetchAddresses = useCallback(async () => {
    if (!isLoggedIn) {
      setIsLoadingAddresses(false);
      return;
    }
    setIsLoadingAddresses(true);
    try {
      const response = await getCustomerAddresses();
      const list = response.data ?? [];
      setAddresses(list);

      const defaultAddress =
        list.find((addr) => addr.id === selectedAddressId) ||
        list.find((addr) => addr.is_default) ||
        list[0];

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setForm({
          shipping_name: defaultAddress.name,
          shipping_phone: defaultAddress.phone,
          shipping_address_line1: defaultAddress.line1,
          shipping_address_line2: defaultAddress.line2 ?? "",
          shipping_city: defaultAddress.city,
          shipping_state: defaultAddress.state ?? "",
          shipping_country: defaultAddress.country,
          shipping_postcode: defaultAddress.postcode ?? "",
        });
      }
    } catch {
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [isLoggedIn, selectedAddressId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // Track when all initial data is loaded
  useEffect(() => {
    // Check if all required data is loaded
    const addressesReady = !isLoggedIn || !isLoadingAddresses; // If not logged in, addresses are ready immediately
    const allDataLoaded =
      addressesReady &&
      !isLoadingStoreLocations &&
      !isLoadingBankAccounts &&
      selectedItems.length > 0;

    if (allDataLoaded && isInitialLoad) {
      // Small delay to ensure smooth transition and all UI is rendered
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoadingAddresses, isLoadingStoreLocations, isLoadingBankAccounts, selectedItems.length, isInitialLoad, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setForm((prev) => ({
      ...prev,
      shipping_name: prev.shipping_name || customer?.profile.name || "",
      shipping_phone: prev.shipping_phone || customer?.profile.phone || "",
    }));
  }, [customer, isLoggedIn]);

  useEffect(() => {
    setVoucherCode(appliedVoucher?.code ?? "");
  }, [appliedVoucher]);

  useEffect(() => {
    setIsLoadingStoreLocations(true);
    getStoreLocations()
      .then((locations) => {
        setStoreLocations(locations);
        if (locations.length > 0) {
          setSelectedStoreId((prev) => prev ?? locations[0].id);
        }
      })
      .catch(() => setStoreLocations([]))
      .finally(() => setIsLoadingStoreLocations(false));
  }, []);

  useEffect(() => {
    setIsLoadingBankAccounts(true);
    getBankAccounts()
      .then((accounts) => {
        setBankAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedBankId(accounts.find((bank) => bank.is_default)?.id ?? accounts[0].id);
        }
      })
      .catch(() => setBankAccounts([]))
      .finally(() => setIsLoadingBankAccounts(false));
  }, []);

  const handleApplyVoucher = async () => {
    const applied = await applyVoucher(voucherCode.trim() || undefined);
    if (applied) {
      setShowVoucherModal(false);
    }
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

    if (shippingMethod === "self_pickup" && !selectedStoreId) {
      setError("Please choose a store location for self pickup.");
      return;
    }

    if (isLoggedIn && shippingMethod === "shipping" && !selectedAddress) {
      setError("Please add and select an address.");
      return;
    }

    if (!isLoggedIn && shippingMethod === "shipping") {
      const required = [
        form.shipping_name,
        form.shipping_phone,
        form.shipping_address_line1,
        form.shipping_city,
        form.shipping_state,
        form.shipping_country,
        form.shipping_postcode,
      ];
      if (required.some((v) => !v)) {
        setError("Please complete your shipping details.");
        return;
      }
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
        store_location_id: shippingMethod === "self_pickup" ? selectedStoreId ?? undefined : undefined,
        bank_account_id: paymentMethod === "manual_transfer" ? selectedBankId ?? undefined : undefined,
      };

      const order = await createOrder(payload);

      await reloadCart();
      clearSelection();
      removeVoucher();
      setVoucherCode("");

      const isBillplzMethod =
        order.payment_method === "billplz_fpx" || order.payment_method === "billplz_card";
      const paymentUrl = order.payment_url ?? order.payment?.billplz_url;

      if (isBillplzMethod) {
        if (paymentUrl) {
          window.location.href = paymentUrl;
        } else {
          setError("Unable to start Billplz payment. Please try again.");
        }
        return;
      }

      const searchParams = new URLSearchParams({
        order_no: order.order_no,
        order_id: String(order.order_id),
        payment_method: order.payment_method,
      });
      if (order.payment_provider ?? order.payment?.provider) {
        searchParams.set("provider", order.payment_provider ?? order.payment?.provider ?? "");
      }

      router.push(`/payment-result?${searchParams.toString()}`);
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

  const selectedAddress = useMemo(
    () => addresses.find((addr) => addr.id === selectedAddressId) ?? addresses.find((addr) => addr.is_default),
    [addresses, selectedAddressId],
  );

  const updateAddressForm = (field: keyof AddressPayload, value: string | boolean) => {
    setAddressForm((prev) => ({ ...prev, [field]: value } as AddressPayload));
  };

  const handleSaveAddress = async () => {
    const payload: AddressPayload = {
      ...addressForm,
      line2: addressForm.line2 || null,
      postcode: addressForm.postcode || null,
    };

    try {
      if (editingAddress) {
        await updateCustomerAddress(editingAddress.id, payload);
      } else {
        await createCustomerAddress(payload);
      }
      await fetchAddresses();
      setAddressMode("list");
      setEditingAddress(null);
      setTempSelectedAddressId(selectedAddressId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to save address.";
      setError(message);
    }
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label,
      type: address.type,
      name: address.name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state ?? "",
      postcode: address.postcode ?? "",
      country: address.country,
      is_default: address.is_default,
    });
    setAddressMode("form");
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      label: "",
      type: "shipping",
      name: customer?.profile.name ?? "",
      phone: customer?.profile.phone ?? "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      country: "Malaysia",
      postcode: "",
      is_default: addresses.length === 0,
    });
    setAddressMode("form");
  };

  const handleSelectAddress = (address: CustomerAddress) => {
    setTempSelectedAddressId(address.id);
  };

  const handleConfirmAddressSelection = async () => {
    if (tempSelectedAddressId === null) return;
    
    const address = addresses.find((addr) => addr.id === tempSelectedAddressId);
    if (!address) return;

    setIsConfirmingAddress(true);
    try {
      setSelectedAddressId(address.id);
      setForm({
        shipping_name: address.name,
        shipping_phone: address.phone,
        shipping_address_line1: address.line1,
        shipping_address_line2: address.line2 ?? "",
        shipping_city: address.city,
        shipping_state: address.state ?? "",
        shipping_country: address.country,
        shipping_postcode: address.postcode ?? "",
      });
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 300));
      setShowAddressModal(false);
    } finally {
      setIsConfirmingAddress(false);
    }
  };

  if (!selectedItems || selectedItems.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-[var(--foreground)]">
        <h1 className="mb-4 text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-[var(--foreground)]/70">
          Your cart is empty. Please add items before checking out.
        </p>
      </main>
    );
  }

  return (
    <>
      <LoadingOverlay message="Loading checkout..." show={isInitialLoad} />
      <main className="mx-auto max-w-5xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {!isSelfPickup && (
            <section className="rounded-xl border border-[var(--muted)] bg-white/80 p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Contact &amp; Address</h2>
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempSelectedAddressId(selectedAddressId);
                      setShowAddressModal(true);
                      setAddressMode("list");
                    }}
                    className="rounded border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--muted)]/70"
                  >
                   Manage
                  </button>
                )}
              </div>

              {isLoggedIn ? (
                <div className="space-y-3">
                  {isLoadingAddresses ? (
                    <div className="h-20 animate-pulse rounded bg-[var(--muted)]/60" />
                  ) : selectedAddress ? (
                    <div className="rounded-lg border border-[var(--muted)]/60 bg-[var(--muted)]/10 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{selectedAddress.name}</p>
                        {selectedAddress.is_default && (
                          <span className="rounded bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] uppercase text-[var(--accent)]">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--foreground)]/70">{selectedAddress.phone}</p>
                      <p className="text-[var(--foreground)]/70">
                        {selectedAddress.line1}
                        {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                      </p>
                      <p className="text-[var(--foreground)]/70">
                        {[selectedAddress.city, selectedAddress.state, selectedAddress.postcode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-[var(--foreground)]/70">{selectedAddress.country}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--foreground)]/70">No saved addresses. Add one to use for this order.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Full Name</label>
                      <input
                        required
                        value={form.shipping_name}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_name: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone Number</label>
                      <input
                        required
                        value={form.shipping_phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_phone: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 1</label>
                      <input
                        required
                        value={form.shipping_address_line1}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_address_line1: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2 (Optional)</label>
                      <input
                        value={form.shipping_address_line2}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_address_line2: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                      <input
                        required
                        value={form.shipping_city}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_city: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                      <input
                        required
                        value={form.shipping_state}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_state: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                      <input
                        required
                        value={form.shipping_postcode}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_postcode: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                    <input
                      required
                      value={form.shipping_country}
                      onChange={(e) => setForm((prev) => ({ ...prev, shipping_country: e.target.value }))}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-[var(--muted)] bg-white/80 p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Items in this order</h2>
              <p className="text-xs text-[var(--foreground)]/60">{selectedItems.length} item(s)</p>
            </div>

            <div className="space-y-3">
              {selectedItems.map((item) => {
                const unitPrice = Number(item.unit_price ?? 0);
                const imageUrl = item.product_image ?? item.product?.images?.[0]?.image_path;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--muted)]/60 bg-white/70 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="relative h-20 w-full overflow-hidden rounded-md border border-[var(--muted)]/70 bg-[var(--muted)]/20 sm:h-20 sm:w-20">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={item.name} fill className="object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[var(--foreground)]/60">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                      <p className="text-xs text-[var(--foreground)]/60">Qty: {item.quantity}</p>
                      {item.sku && <p className="text-[11px] text-[var(--foreground)]/50">SKU: {item.sku}</p>}
                    </div>

                    <div className="space-y-1 text-sm text-right sm:min-w-[140px]">
                      <p className="text-[var(--foreground)]/70">Unit: RM {unitPrice.toFixed(2)}</p>
                      <p className="font-semibold text-[var(--accent-strong)]">
                        Total: RM {(unitPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4 rounded-xl border border-[var(--muted)] bg-white/80 p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">Order Summary</h2>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-3 text-sm">
            <div>
              <p className="text-xs font-medium text-[var(--foreground)]/70">Voucher / Discount</p>
              {appliedVoucher && (
                <p className="text-xs text-[var(--foreground)]/70">Applied: {appliedVoucher.code}</p>
              )}
              {voucherMessage && !appliedVoucher && (
                <p className="text-[11px] text-[var(--foreground)]/60">{voucherMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {appliedVoucher && (
                <button
                  type="button"
                  onClick={() => {
                    removeVoucher();
                    setVoucherCode("");
                  }}
                  className="rounded border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]/70"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                disabled={selectedItems.length === 0}
                onClick={() => {
                  clearVoucherFeedback();
                  setVoucherCode(appliedVoucher?.code ?? "");
                  setShowVoucherModal(true);
                }}
                className="rounded bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold uppercase text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Voucher
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">Shipping Method</div>
            <div className="space-y-2 text-sm">
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
                  value="self_pickup"
                  checked={shippingMethod === "self_pickup"}
                  onChange={() => setShippingMethod("self_pickup")}
                />
                <span>Self Pickup (RM 0)</span>
              </label>
            </div>
          </div>

          {shippingMethod === "self_pickup" && (
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
            <div className="mb-1 text-xs font-medium text-[var(--foreground)]/70">Payment Method</div>
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
                      <label
                        key={bank.id}
                        className="flex items-start gap-2 rounded border border-transparent p-2 hover:border-[var(--accent)]/60"
                      >
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
                          {/* {bank.branch && (
                            <div className="text-[var(--foreground)]/60">Branch: {bank.branch}</div>
                          )} */}
                          {bank.qr_image_url && (
                            <div className="mt-2 h-20 w-20 overflow-hidden rounded border border-[var(--muted)] bg-white">
                              <Image
                                src={bank.qr_image_url}
                                alt={`${bank.bank_name} QR`}
                                width={80}
                                height={80}
                                className="h-full w-full object-contain"
                              />
                            </div>
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
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_method"
                  value="billplz_card"
                  checked={paymentMethod === "billplz_card"}
                  onChange={() => setPaymentMethod("billplz_card")}
                />
                <span>Credit Card (Billplz)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[#b8527a]">{error}</div>
          )}

          <div className="space-y-2 rounded-lg border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>RM {safeTotals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>- RM {safeTotals.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>{shippingMethod === "shipping" ? shippingLabel ?? "Shipping" : "Self Pickup"}</span>
              <span>RM {safeTotals.shipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand Total</span>
              <span>RM {safeTotals.grand.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold uppercase text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </form>

      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {isConfirmingAddress && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--accent)]"></div>
                <p className="text-sm font-medium text-[var(--foreground)]/70">Updating address...</p>
              </div>
            </div>
          )}
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 text-[var(--foreground)] shadow-lg sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {addressMode === "form" ? (editingAddress ? "Edit Address" : "Add Address") : "Manage Addresses"}
              </h3>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  setTempSelectedAddressId(selectedAddressId);
                }}
                className="text-sm text-[var(--foreground)]/70"
              >
                ✕
              </button>
            </div>

            {addressMode === "list" ? (
              <div className="space-y-3">
                {addresses.length === 0 && (
                  <p className="text-xs text-[var(--foreground)]/70">No saved addresses. Add one to get started.</p>
                )}

                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex flex-1 cursor-pointer gap-3">
                          <input
                            type="radio"
                            name="address"
                            checked={tempSelectedAddressId === address.id}
                            onChange={() => handleSelectAddress(address)}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{address.label || address.name}</p>
                              {address.is_default && (
                                <span className="rounded bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] uppercase text-[var(--accent)]">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-[var(--foreground)]/70">{address.name}</p>
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
                        <div className="flex items-center gap-2">
                          {!address.is_default && (
                            <button
                              type="button"
                              onClick={async () => {
                                await makeDefaultCustomerAddress(address.id);
                                await fetchAddresses();
                                if (selectedAddressId === address.id) {
                                  setSelectedAddressId(address.id);
                                }
                              }}
                              className="rounded border border-[var(--accent)] px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--muted)]/70 whitespace-nowrap"
                              title="Set as default"
                            >
                              Set as default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditAddress(address)}
                            className="flex items-center justify-center rounded border border-[#f1a5be] p-1.5 text-[#b8527a] hover:bg-[var(--muted)]/70"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteCustomerAddress(address.id);
                              await fetchAddresses();
                              if (selectedAddressId === address.id) {
                                const remainingAddress = addresses.find((addr) => addr.id !== address.id);
                                if (remainingAddress) {
                                  setSelectedAddressId(remainingAddress.id);
                                  setForm({
                                    shipping_name: remainingAddress.name,
                                    shipping_phone: remainingAddress.phone,
                                    shipping_address_line1: remainingAddress.line1,
                                    shipping_address_line2: remainingAddress.line2 ?? "",
                                    shipping_city: remainingAddress.city,
                                    shipping_state: remainingAddress.state ?? "",
                                    shipping_country: remainingAddress.country,
                                    shipping_postcode: remainingAddress.postcode ?? "",
                                  });
                                } else {
                                  setSelectedAddressId(null);
                                }
                              }
                            }}
                            className="flex items-center justify-center rounded border border-[#f1a5be] p-1.5 text-[#b8527a] hover:bg-[var(--muted)]/70"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    className="rounded border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--muted)]/70"
                  >
                    Add Address
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddressSelection}
                    disabled={tempSelectedAddressId === null || isConfirmingAddress}
                    className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isConfirmingAddress ? "Confirming..." : "Confirm"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Label</label>
                    <input
                      value={addressForm.label ?? ""}
                      onChange={(e) => updateAddressForm("label", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Type</label>
                    <select
                      value={addressForm.type}
                      onChange={(e) => updateAddressForm("type", e.target.value as AddressPayload["type"])}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    >
                      <option value="shipping">Shipping</option>
                      <option value="billing">Billing</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Full Name</label>
                    <input
                      value={addressForm.name}
                      onChange={(e) => updateAddressForm("name", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone</label>
                    <input
                      value={addressForm.phone}
                      onChange={(e) => updateAddressForm("phone", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 1</label>
                  <input
                    value={addressForm.line1}
                    onChange={(e) => updateAddressForm("line1", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2</label>
                  <input
                    value={addressForm.line2 ?? ""}
                    onChange={(e) => updateAddressForm("line2", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                    <input
                      value={addressForm.city}
                      onChange={(e) => updateAddressForm("city", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                    <input
                      value={addressForm.state ?? ""}
                      onChange={(e) => updateAddressForm("state", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                    <input
                      value={addressForm.postcode ?? ""}
                      onChange={(e) => updateAddressForm("postcode", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                  <input
                    value={addressForm.country}
                    onChange={(e) => updateAddressForm("country", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]/80">
                  <input
                    type="checkbox"
                    checked={!!addressForm.is_default}
                    onChange={(e) => updateAddressForm("is_default", e.target.checked)}
                  />
                  Set as default shipping address
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddressMode("list");
                      setEditingAddress(null);
                      setTempSelectedAddressId(selectedAddressId);
                    }}
                    className="rounded border border-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAddress}
                    className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
                  >
                    Save Address
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 text-[var(--foreground)] shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Apply Voucher</h3>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Enter voucher code"
                className="w-full rounded border border-[var(--muted)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                disabled={isApplyingVoucher || !voucherCode.trim()}
                className="w-full rounded bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply"}
              </button>
              {voucherError && <p className="text-xs text-[#c26686]">{voucherError}</p>}
              {voucherMessage && !appliedVoucher && (
                <p className="text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
