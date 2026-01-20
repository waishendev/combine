"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getPrimaryProductImage } from "@/lib/productMedia";
import VoucherDetailsModal from "@/components/vouchers/VoucherDetailsModal";
import VoucherList from "@/components/vouchers/VoucherList";
import {
  AddressPayload,
  CheckoutPayload,
  CheckoutPreviewResponse,
  CustomerAddress,
  CustomerVoucher,
  PublicBankAccount,
  PublicPaymentGateway,
  PublicStoreLocation,
  createCustomerAddress,
  createOrder,
  deleteCustomerAddress,
  getCustomerAddresses,
  getBankAccounts,
  getPaymentGateways,
  getStoreLocations,
  getCustomerVouchers,
  makeDefaultCustomerAddress,
  previewCheckout,
  updateCustomerAddress,
} from "@/lib/apiClient";

const COUNTRY_OPTIONS = [
  { value: "MY", label: "Malaysia" },
  { value: "SG", label: "Singapore" },
];

const MALAYSIA_STATES_WEST = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
  "Selangor",
  "Terengganu",
];

const MALAYSIA_STATES_EAST = ["Sabah", "Sarawak", "Labuan"];

const scopeLabels: Record<string, string> = {
  all: "Storewide",
  products: "Specific Products",
  categories: "Specific Categories",
};

const normalizeCountryValue = (country?: string | null) => {
  if (!country) return "";
  const normalized = country.trim().toUpperCase();
  if (normalized === "MALAYSIA") return "MY";
  if (normalized === "SINGAPORE") return "SG";
  if (normalized === "MY" || normalized === "SG") return normalized;
  return country;
};

const formatCountryLabel = (country?: string | null) => {
  const code = normalizeCountryValue(country);
  return COUNTRY_OPTIONS.find((option) => option.value === code)?.label ?? country ?? "";
};

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
    isLoading,
    hasLoadedCart,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasNavigatedRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [detailsVoucherId, setDetailsVoucherId] = useState<number | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PublicPaymentGateway[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PublicBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [storeLocations, setStoreLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [shippingPreview, setShippingPreview] = useState<CheckoutPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [tempSelectedAddressId, setTempSelectedAddressId] = useState<number | null>(null);
  const isLoggedIn = !!customer;
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(isLoggedIn); // Initialize as true if logged in
  const [isConfirmingAddress, setIsConfirmingAddress] = useState(false);
  const [isLoadingStoreLocations, setIsLoadingStoreLocations] = useState(true);
  const [isLoadingPaymentGateways, setIsLoadingPaymentGateways] = useState(true);
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
    country: "MY",
    postcode: "",
    is_default: false,
  });
  const [addressFormErrors, setAddressFormErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    shipping_name: "",
    shipping_phone: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_country: "MY",
    shipping_postcode: "",
  });
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingForm, setBillingForm] = useState({
    billing_name: "",
    billing_phone: "",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_country: "MY",
    billing_postcode: "",
  });

  const isSelfPickup = shippingMethod === "self_pickup";
  const isShippingMalaysia = normalizeCountryValue(form.shipping_country) === "MY";
  const isAddressMalaysia = normalizeCountryValue(addressForm.country) === "MY";
  const isBillingMalaysia = normalizeCountryValue(billingForm.billing_country) === "MY";
  const hasMissingVariant = selectedItems.some(
    (item) => item.product_type === "variant" && !item.product_variant_id,
  );
  
  const safeTotals = useMemo(() => {
    const previewSubtotal = Number(shippingPreview?.subtotal ?? totals.subtotal ?? 0);
    const previewDiscount = Number(shippingPreview?.discount_total ?? totals.discount_total ?? 0);
    const previewShipping = Number(shippingPreview?.shipping_fee ?? totals.shipping_fee ?? shippingFlatFee ?? 0);
    const previewGrand = Number(shippingPreview?.grand_total ?? previewSubtotal - previewDiscount + previewShipping);

    const subtotal = previewSubtotal;
    const discount = previewDiscount;
    const shipping = isSelfPickup ? 0 : previewShipping;
    const computedGrand = subtotal - discount + shipping;
    const grand = isSelfPickup ? computedGrand : previewGrand;

    return { subtotal, discount, shipping, grand };
  }, [
    isSelfPickup,
    shippingFlatFee,
    shippingPreview?.discount_total,
    shippingPreview?.grand_total,
    shippingPreview?.shipping_fee,
    shippingPreview?.subtotal,
    totals.discount_total,
    totals.grand_total,
    totals.shipping_fee,
    totals.subtotal,
  ]);

  const shippingSummaryLabel = shippingPreview?.shipping?.label
    ? `Delivery (${shippingPreview.shipping.label})`
    : shippingLabel ?? "Delivery";
  const shippingIsFree = shippingPreview?.shipping?.is_free ?? false;
  const freeShippingMinOrderAmount = shippingPreview?.shipping?.free_shipping_min_order_amount;
  const hasFreeShippingThreshold = freeShippingMinOrderAmount !== null && freeShippingMinOrderAmount !== undefined;

  const formatCurrency = (value: number) => `RM ${value.toFixed(2)}`;
  const freeShippingThresholdLabel = hasFreeShippingThreshold
    ? ` (Spend ${formatCurrency(Number(freeShippingMinOrderAmount))}+)`
    : "";
  const shippingSummaryText =
    shippingMethod === "shipping"
      ? shippingIsFree
        ? `Free Shipping${freeShippingThresholdLabel}`
        : shippingSummaryLabel
      : "Self Pickup";

  const formatExpiry = (dateValue?: string | null) => {
    if (!dateValue) return "No expiry";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "No expiry";
    return date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
  };

  const visibleVouchers = useMemo(() => {
    const now = Date.now();
    return vouchers
      .filter((voucher) => {
        const expiry = voucher.expires_at ?? voucher.voucher?.end_at ?? null;
        if (!expiry) return true;
        const expiryDate = new Date(expiry);
        if (Number.isNaN(expiryDate.getTime())) return true;
        return expiryDate.getTime() >= now;
      })
      .map((voucher) => {
        const minOrderAmount = Number(voucher.voucher?.min_order_amount ?? 0);
        const minSpendMet = safeTotals.subtotal >= minOrderAmount;
        const value = Number(voucher.voucher?.value ?? 0);
        const valueLabel =
          voucher.voucher?.type === "percent" ? `${value}%` : formatCurrency(value);
        const title = voucher.voucher?.code
          ? `Voucher: ${voucher.voucher?.code}`
          : "Voucher";
        const expiryLabel = formatExpiry(voucher.expires_at ?? voucher.voucher?.end_at ?? null);

        return {
          voucher,
          minOrderAmount,
          minSpendMet,
          valueLabel,
          title,
          expiryLabel,
        };
      });
  }, [safeTotals.subtotal, vouchers]);

  const selectedVoucher = visibleVouchers.find((entry) => entry.voucher.id === selectedVoucherId);
  const isSelectedVoucherEligible = selectedVoucher?.minSpendMet ?? false;
  const voucherErrorMessage = voucherError || voucherMessage || null;

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
          shipping_country: normalizeCountryValue(defaultAddress.country),
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

  const selectedAddress = useMemo(
    () => addresses.find((addr) => addr.id === selectedAddressId) ?? addresses.find((addr) => addr.is_default),
    [addresses, selectedAddressId],
  );

  // Get current country and state for shipping fee display logic
  const currentCountry = isLoggedIn && selectedAddress 
    ? normalizeCountryValue(selectedAddress.country) 
    : normalizeCountryValue(form.shipping_country);
  const currentState = isLoggedIn && selectedAddress 
    ? selectedAddress.state 
    : form.shipping_state;
  
  const shippingFeeDisplay =
    shippingMethod === "shipping"
      ? !currentCountry
        ? "Select country to see delivery fee"
        : currentCountry === "MY" && !currentState
          ? "Select state to see delivery fee"
          : isPreviewLoading
            ? "Calculating..."
            : shippingPreview
              ? shippingIsFree
                ? formatCurrency(0)
                : formatCurrency(safeTotals.shipping)
              : "Calculated at checkout"
      : "RM 0.00";

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
    if (shippingMethod !== "shipping") {
      setShippingPreview(null);
      return;
    }

    if (selectedItems.length === 0) {
      setShippingPreview(null);
      return;
    }
    if (hasMissingVariant) {
      setShippingPreview(null);
      return;
    }

    const addressSource = isLoggedIn ? selectedAddress : null;
    const country = normalizeCountryValue(addressSource?.country ?? form.shipping_country);
    const state = addressSource?.state ?? form.shipping_state;

    if (!country) {
      setShippingPreview(null);
      return;
    }

    if (country === "MY" && !state) {
      setShippingPreview(null);
      return;
    }

    const payloadItems = selectedItems.map((item) => ({
      product_id: item.product_id,
      product_variant_id: item.product_variant_id ?? undefined,
      quantity: item.quantity,
      is_reward: item.is_reward,
      reward_redemption_id: item.reward_redemption_id ?? undefined,
    }));

    setIsPreviewLoading(true);
    previewCheckout({
      items: payloadItems,
      shipping_method: "shipping",
      shipping_country: country,
      shipping_state: country === "MY" ? state ?? null : null,
      voucher_code: appliedVoucher?.code ?? undefined,
      customer_voucher_id: appliedVoucher?.customer_voucher_id ?? undefined,
      session_token: sessionToken ?? undefined,
      billing_same_as_shipping: billingSameAsShipping,
      ...(billingSameAsShipping
        ? {}
        : {
            billing_name: billingForm.billing_name,
            billing_phone: billingForm.billing_phone,
            billing_address_line1: billingForm.billing_address_line1,
            billing_address_line2: billingForm.billing_address_line2 || null,
            billing_city: billingForm.billing_city,
            billing_state: billingForm.billing_state,
            billing_country: billingForm.billing_country,
            billing_postcode: billingForm.billing_postcode,
          }),
    })
      .then((response) => setShippingPreview(response))
      .catch(() => setShippingPreview(null))
      .finally(() => setIsPreviewLoading(false));
  }, [
    appliedVoucher?.code,
    appliedVoucher?.customer_voucher_id,
    billingForm,
    billingSameAsShipping,
    form.shipping_country,
    form.shipping_state,
    isLoggedIn,
    selectedAddress,
    selectedItems,
    hasMissingVariant,
    sessionToken,
    shippingMethod,
  ]);

  // const shouldRedirectToCart = hasLoadedCart && selectedItems.length === 0;

  // useEffect(() => {
  //   if (!shouldRedirectToCart) return;
  //   router.replace("/cart");
  // }, [shouldRedirectToCart, router]);

  useEffect(() => {
    // Sync selectedVoucherId with applied voucher, but don't show code in input field
    setSelectedVoucherId(appliedVoucher?.customer_voucher_id ?? null);
    // Don't auto-fill voucher code - let user see empty input when opening modal
  }, [appliedVoucher]);

  useEffect(() => {
    setIsLoadingPaymentGateways(true);
    getPaymentGateways()
      .then((gateways) => {
        const activeGateways = gateways.filter((gateway) => gateway.is_active);
        setPaymentGateways(activeGateways);

        if (activeGateways.length > 0) {
          const defaultGateway = activeGateways.find((gateway) => gateway.is_default) ?? activeGateways[0];
          setPaymentMethod((prev) =>
            prev && activeGateways.some((gateway) => gateway.key === prev) ? prev : defaultGateway.key,
          );
        } else {
          setPaymentMethod((prev) => prev || "manual_transfer");
        }
      })
      .catch(() => {
        setPaymentGateways([]);
        setPaymentMethod((prev) => prev || "manual_transfer");
      })
      .finally(() => setIsLoadingPaymentGateways(false));
  }, []);

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
    if (paymentMethod !== "manual_transfer") {
      setIsLoadingBankAccounts(false);
      return;
    }

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
  }, [paymentMethod]);

  useEffect(() => {
    setBillingSameAsShipping(true);
  }, [shippingMethod]);

  useEffect(() => {
    if (!showVoucherModal) return;
    setLoadingVouchers(true);
    getCustomerVouchers({ status: "active" })
      .then((data) => setVouchers(data ?? []))
      .catch(() => setVouchers([]))
      .finally(() => setLoadingVouchers(false));
  }, [showVoucherModal]);

  const handleApplyCodeVoucher = async () => {
    const applied = await applyVoucher(voucherCode.trim() || undefined, undefined);
    if (applied) {
      setShowVoucherModal(false);
    }
  };

  const handleApplySelectedVoucher = async () => {
    if (!selectedVoucherId) return;
    const applied = await applyVoucher(undefined, selectedVoucherId);
    if (applied) {
      setShowVoucherModal(false);
    }
  };

  const handleVoucherChange = (value: string) => {
    setVoucherCode(value);
    if (selectedVoucherId) setSelectedVoucherId(null);
    clearVoucherFeedback();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItems || selectedItems.length === 0) {
      setError("Please select at least one item in your cart.");
      return;
    }
    if (hasMissingVariant) {
      setError("Please select variants for all variant items before checkout.");
      return;
    }

    if (!paymentMethod) {
      setError("Please select a payment method.");
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

    if (shippingMethod === "self_pickup") {
      if (!form.shipping_name || !form.shipping_phone) {
        setError("Please provide your name and phone number for pickup.");
        return;
      }
    }

    if (isLoggedIn && shippingMethod === "shipping" && !selectedAddress) {
      setError("Please add and select an address.");
      return;
    }

    if (isLoggedIn && shippingMethod === "shipping" && selectedAddress) {
      const selectedCountry = normalizeCountryValue(selectedAddress.country);
      if (selectedCountry === "MY" && !selectedAddress.state) {
        setError("Please select a state for your shipping address.");
        return;
      }
    }

    if (!isLoggedIn && shippingMethod === "shipping") {
      const required = [
        form.shipping_name,
        form.shipping_phone,
        form.shipping_address_line1,
        form.shipping_city,
        form.shipping_country,
        form.shipping_postcode,
      ];
      if (required.some((v) => !v)) {
        setError("Please complete your shipping details.");
        return;
      }

      if (normalizeCountryValue(form.shipping_country) === "MY" && !form.shipping_state) {
        setError("Please complete your shipping details.");
        return;
      }
    }

    if (!billingSameAsShipping) {
      const required = [
        billingForm.billing_name,
        billingForm.billing_phone,
        billingForm.billing_address_line1,
        billingForm.billing_city,
        billingForm.billing_country,
        billingForm.billing_postcode,
      ];
      if (required.some((v) => !v)) {
        setError("Please complete your billing details.");
        return;
      }

      if (normalizeCountryValue(billingForm.billing_country) === "MY" && !billingForm.billing_state) {
        setError("Please complete your billing details.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const trimmedVoucherCode = voucherCode.trim();
      const voucherCodeForSubmit = selectedVoucherId
        ? undefined
        : (appliedVoucher?.code ?? trimmedVoucherCode) || undefined;
      const payload: CheckoutPayload = {
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id ?? undefined,
          quantity: item.quantity,
          is_reward: item.is_reward,
          reward_redemption_id: item.reward_redemption_id ?? undefined,
        })),
        session_token: sessionToken ?? undefined,
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        ...form,
        billing_same_as_shipping: billingSameAsShipping,
        voucher_code: voucherCodeForSubmit,
        customer_voucher_id: selectedVoucherId ?? undefined,
        store_location_id: shippingMethod === "self_pickup" ? selectedStoreId ?? undefined : undefined,
        bank_account_id: paymentMethod === "manual_transfer" ? selectedBankId ?? undefined : undefined,
      };
      if (!billingSameAsShipping) {
        payload.billing_name = billingForm.billing_name;
        payload.billing_phone = billingForm.billing_phone;
        payload.billing_address_line1 = billingForm.billing_address_line1;
        payload.billing_address_line2 = billingForm.billing_address_line2 || null;
        payload.billing_city = billingForm.billing_city;
        payload.billing_state = billingForm.billing_state;
        payload.billing_country = billingForm.billing_country;
        payload.billing_postcode = billingForm.billing_postcode;
      }

      const order = await createOrder(payload);

      await reloadCart();
      clearSelection();
      removeVoucher();
      setVoucherCode("");
      setSelectedVoucherId(null);

      const isBillplzMethod =
        order.payment_method === "billplz_fpx" || order.payment_method === "billplz_card";
      const paymentUrl = order.payment_url ?? order.payment?.billplz_url;

      if (isBillplzMethod) {
        if (paymentUrl) {
          hasNavigatedRef.current = true;
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

      hasNavigatedRef.current = true;
      router.replace(`/payment-result?${searchParams.toString()}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create order.";
      setError(message);
    } finally {
      if (!hasNavigatedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const selectedBank = useMemo(
    () => bankAccounts.find((bank) => bank.id === selectedBankId) ?? bankAccounts[0],
    [bankAccounts, selectedBankId],
  );

  const updateAddressForm = (field: keyof AddressPayload, value: string | boolean) => {
    setAddressForm((prev) => ({ ...prev, [field]: value } as AddressPayload));
    // Clear error for this field when user starts typing
    if (addressFormErrors[field]) {
      setAddressFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSaveAddress = async () => {
    const payload: AddressPayload = {
      ...addressForm,
      line2: addressForm.line2 || null,
      postcode: addressForm.postcode || null,
    };

    // Clear previous errors
    setAddressFormErrors({});
    setError(null);

    try {
      if (editingAddress) {
        await updateCustomerAddress(editingAddress.id, payload);
      } else {
        await createCustomerAddress(payload);
      }
      
      // Only update the address list, don't auto-select
      const response = await getCustomerAddresses();
      const list = response.data ?? [];
      setAddresses(list);
      
      setAddressMode("list");
      setEditingAddress(null);
      // Keep the current temp selection, don't auto-select the new/edited address
      setTempSelectedAddressId(tempSelectedAddressId);
      setAddressFormErrors({});
    } catch (err: unknown) {
      // Check if error has validation errors structure
      if (err && typeof err === "object" && "data" in err) {
        const errorData = err.data as unknown;
        if (errorData && typeof errorData === "object" && "errors" in errorData) {
          const errors = errorData.errors as Record<string, string[] | string>;
          const formattedErrors: Record<string, string[]> = {};
          
          // Convert errors to array format
          for (const [key, value] of Object.entries(errors)) {
            if (Array.isArray(value)) {
              formattedErrors[key] = value;
            } else if (typeof value === "string") {
              formattedErrors[key] = [value];
            }
          }
          
          setAddressFormErrors(formattedErrors);
          
          // Also set general error message if available
          if ("message" in errorData && typeof errorData.message === "string") {
            setError(errorData.message);
          }
          return;
        }
      }
      
      // Fallback to generic error
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
      country: normalizeCountryValue(address.country),
      is_default: address.is_default,
    });
    setAddressFormErrors({});
    setError(null);
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
      country: "MY",
      postcode: "",
      is_default: addresses.length === 0,
    });
    setAddressFormErrors({});
    setError(null);
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
        shipping_country: normalizeCountryValue(address.country),
        shipping_postcode: address.postcode ?? "",
      });
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 300));
      setShowAddressModal(false);
    } finally {
      setIsConfirmingAddress(false);
    }
  };

  if (isSubmitting || isLoading || !hasLoadedCart ) {
    return (
      <LoadingOverlay
        message={isSubmitting ? "Placing order..." : "Loading checkout..."}
        show={isSubmitting || isInitialLoad || isLoading}
      />
    );
  }

  return (
    <>

      <main className="mx-auto max-w-5xl px-4 py-8 text-[var(--foreground)]">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {!isSelfPickup ? (
            <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
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
                      <p className="text-[var(--foreground)]/70">
                        {formatCountryLabel(selectedAddress.country)}
                      </p>
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
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone Number</label>
                      <input
                        required
                        value={form.shipping_phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_phone: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
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
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2 (Optional)</label>
                      <input
                        value={form.shipping_address_line2}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_address_line2: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
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
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                      {isShippingMalaysia ? (
                        <select
                          required
                          value={form.shipping_state}
                          onChange={(e) => setForm((prev) => ({ ...prev, shipping_state: e.target.value }))}
                          className="w-full rounded border border-[var(--muted)] bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                        >
                          <option value="">Select state</option>
                          {MALAYSIA_STATES_WEST.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                          {MALAYSIA_STATES_EAST.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={form.shipping_state}
                          onChange={(e) => setForm((prev) => ({ ...prev, shipping_state: e.target.value }))}
                          className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                      <input
                        required
                        value={form.shipping_postcode}
                        onChange={(e) => setForm((prev) => ({ ...prev, shipping_postcode: e.target.value }))}
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                    <select
                      required
                      value={form.shipping_country}
                      onChange={(e) => {
                        const nextCountry = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          shipping_country: nextCountry,
                          shipping_state: normalizeCountryValue(nextCountry) === "MY" ? prev.shipping_state : "",
                        }));
                      }}
                      className="w-full rounded border border-[var(--muted)] bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    >
                      {COUNTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Pickup Contact</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Full Name</label>
                  <input
                    required
                    value={form.shipping_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipping_name: e.target.value }))}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone Number</label>
                  <input
                    required
                    value={form.shipping_phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, shipping_phone: e.target.value }))}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--foreground)]/70">
                We need your name and phone to create the payment and prepare your pickup.
              </p>
            </section>
          )}

          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Billing Address</h2>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--foreground)]/80">
              <input
                type="checkbox"
                checked={billingSameAsShipping}
                onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                className="h-4 w-4 rounded border border-[var(--muted)] text-[var(--accent)] focus:ring-[var(--accent)] ios-input"
              />
              <span>
                {shippingMethod === "self_pickup"
                  ? "Same as Pickup Contact"
                  : "Same as Shipping Address"}
              </span>
            </label>

            {!billingSameAsShipping && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Full Name</label>
                    <input
                      required
                      value={billingForm.billing_name}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, billing_name: e.target.value }))}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone Number</label>
                    <input
                      required
                      value={billingForm.billing_phone}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, billing_phone: e.target.value }))}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 1</label>
                    <input
                      required
                      value={billingForm.billing_address_line1}
                      onChange={(e) =>
                        setBillingForm((prev) => ({ ...prev, billing_address_line1: e.target.value }))
                      }
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2 (Optional)</label>
                    <input
                      value={billingForm.billing_address_line2}
                      onChange={(e) =>
                        setBillingForm((prev) => ({ ...prev, billing_address_line2: e.target.value }))
                      }
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                    <input
                      required
                      value={billingForm.billing_city}
                      onChange={(e) => setBillingForm((prev) => ({ ...prev, billing_city: e.target.value }))}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">State</label>
                    {isBillingMalaysia ? (
                      <select
                        required
                        value={billingForm.billing_state}
                        onChange={(e) =>
                          setBillingForm((prev) => ({ ...prev, billing_state: e.target.value }))
                        }
                        className="w-full rounded border border-[var(--muted)] bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      >
                        <option value="">Select state</option>
                        {MALAYSIA_STATES_WEST.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                        {MALAYSIA_STATES_EAST.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={billingForm.billing_state}
                        onChange={(e) =>
                          setBillingForm((prev) => ({ ...prev, billing_state: e.target.value }))
                        }
                        className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                    <input
                      required
                      value={billingForm.billing_postcode}
                      onChange={(e) =>
                        setBillingForm((prev) => ({ ...prev, billing_postcode: e.target.value }))
                      }
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                  <select
                    required
                    value={billingForm.billing_country}
                    onChange={(e) => {
                      const nextCountry = e.target.value;
                      setBillingForm((prev) => ({
                        ...prev,
                        billing_country: nextCountry,
                        billing_state: normalizeCountryValue(nextCountry) === "MY" ? prev.billing_state : "",
                      }));
                    }}
                    className="w-full rounded border border-[var(--muted)] bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Items in this order</h2>
              <p className="text-xs text-[var(--foreground)]/60">{selectedItems.length} item(s)</p>
            </div>

            <div className="space-y-3">
              {selectedItems.map((item) => {
                const unitPrice = Number(item.unit_price ?? 0);
                const imageUrl =
                  item.product_image ??
                  getPrimaryProductImage({
                    product_image: item.product_image ?? null,
                    cover_image_url:
                      (item as { cover_image_url?: string | null }).cover_image_url ??
                      item.product?.cover_image_url ??
                      null,
                    images: item.product?.images,
                    media: item.product?.media,
                  });

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/70 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="relative h-20 w-full overflow-hidden rounded-md border border-[var(--muted)]/70 bg-[var(--muted)]/20 sm:h-20 sm:w-20">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={item.name} fill className="object-contain" />
                      ) : (
                        <Image src="/images/placeholder.png" alt={item.name} fill className="object-contain" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                      
                      {item.sku && <p className="text-[11px] text-[var(--foreground)]/50">SKU: {item.sku}</p>}
                      {item.variant_name && (
                        <p className="text-[11px] text-[var(--foreground)]/50">
                          Variant: {item.variant_name}
                        </p>
                      )}
                      <p className="text-xs text-[var(--foreground)]/60">Qty: {item.quantity}</p>

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

        <aside className="space-y-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)]/80 p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">Order Summary</h2>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-3 text-sm">
            <div>
              <p className="text-xs font-medium text-[var(--foreground)]/70">Voucher / Discount</p>
              {appliedVoucher && (
                <div className="space-y-1 text-xs text-[var(--foreground)]/70">
                  <p>Applied: {appliedVoucher.code}</p>
                  {appliedVoucher.eligible_subtotal != null && (
                    <p>
                      Voucher applies to RM {Number(appliedVoucher.eligible_subtotal).toFixed(2)} eligible items
                    </p>
                  )}
                  {appliedVoucher.display_scope_text && (
                    <p className="text-[10px] text-[var(--foreground)]/60">
                      {appliedVoucher.display_scope_text}
                    </p>
                  )}
                </div>
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
                    setSelectedVoucherId(null);
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
                  setVoucherCode("");
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
                <span>Delivery 
                  {/* {shippingLabel ?? "Shipping fees"} */}
                </span>
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
              {isLoadingPaymentGateways ? (
                <p className="text-xs text-[var(--foreground)]/70">Loading payment methods...</p>
              ) : paymentGateways.length === 0 ? (
                <p className="text-xs text-[var(--foreground)]/70">No payment methods available.</p>
              ) : (
                paymentGateways.map((gateway) => (
                  <div key={gateway.id} className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_method"
                        value={gateway.key}
                        checked={paymentMethod === gateway.key}
                        onChange={() => setPaymentMethod(gateway.key)}
                      />
                      <span>{gateway.name}</span>
                    </label>

                    {gateway.key === "manual_transfer" && paymentMethod === "manual_transfer" && (
                      <>
                        {isLoadingBankAccounts ? (
                          <p className="text-xs text-[var(--foreground)]/70">Loading bank accounts...</p>
                        ) : bankAccounts.length > 0 ? (
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
                                    {bank.qr_image_url && (
                                      <div className="mt-2 h-20 w-20 overflow-hidden rounded border border-[var(--card-border)] bg-[var(--card)]">
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
                        ) : (
                          <p className="text-xs text-[var(--foreground)]/70">
                            Bank transfer details will be provided after placing the order.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="rounded bg-[var(--muted)] px-3 py-2 text-xs text-[var(--accent-stronger)]">{error}</div>
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
              <span>{shippingSummaryText}</span>
              <span>{shippingFeeDisplay}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand Total</span>
              <span>RM {safeTotals.grand.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || selectedItems.length === 0}
            className="mt-1 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold uppercase text-white transition-colors hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </button>
        </aside>
      </form>

      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {isConfirmingAddress && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--card)]/90 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--accent)]"></div>
                <p className="text-sm font-medium text-[var(--foreground)]/70">Updating address...</p>
              </div>
            </div>
          )}
          <div className="w-full max-w-2xl rounded-lg bg-[var(--card)] p-4 text-[var(--foreground)] shadow-lg sm:p-5">
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
                            <p className="text-[var(--foreground)]/70">
                              {formatCountryLabel(address.country)}
                            </p>
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
                            className="flex items-center justify-center rounded border border-[var(--accent)] p-1.5 text-[var(--accent-stronger)] hover:bg-[var(--muted)]/70"
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
                            className="flex items-center justify-center rounded border border-[var(--accent)] p-1.5 text-[var(--accent-stronger)] hover:bg-[var(--muted)]/70"
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
                {error && (
                  <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Label</label>
                    <input
                      value={addressForm.label ?? ""}
                      onChange={(e) => updateAddressForm("label", e.target.value)}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Type</label>
                    <select
                      value={addressForm.type}
                      onChange={(e) => updateAddressForm("type", e.target.value as AddressPayload["type"])}
                      className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
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
                      className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                        addressFormErrors.name ? "border-red-500" : "border-[var(--muted)]"
                      }`}
                    />
                    {addressFormErrors.name && (
                      <p className="mt-1 text-xs text-red-500">{addressFormErrors.name[0]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Phone</label>
                    <input
                      value={addressForm.phone}
                      onChange={(e) => updateAddressForm("phone", e.target.value)}
                      className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                        addressFormErrors.phone ? "border-red-500" : "border-[var(--muted)]"
                      }`}
                    />
                    {addressFormErrors.phone && (
                      <p className="mt-1 text-xs text-red-500">{addressFormErrors.phone[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 1</label>
                  <input
                    value={addressForm.line1}
                    onChange={(e) => updateAddressForm("line1", e.target.value)}
                    className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                      addressFormErrors.line1 ? "border-red-500" : "border-[var(--muted)]"
                    }`}
                  />
                  {addressFormErrors.line1 && (
                    <p className="mt-1 text-xs text-red-500">{addressFormErrors.line1[0]}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Address Line 2</label>
                  <input
                    value={addressForm.line2 ?? ""}
                    onChange={(e) => updateAddressForm("line2", e.target.value)}
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">City</label>
                    <input
                      value={addressForm.city}
                      onChange={(e) => updateAddressForm("city", e.target.value)}
                      className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                        addressFormErrors.city ? "border-red-500" : "border-[var(--muted)]"
                      }`}
                    />
                    {addressFormErrors.city && (
                      <p className="mt-1 text-xs text-red-500">{addressFormErrors.city[0]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">
                      State
                    </label>
                    {isAddressMalaysia ? (
                      <select
                        required
                        value={addressForm.state ?? ""}
                        onChange={(e) => updateAddressForm("state", e.target.value)}
                        className={`w-full rounded border bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                          addressFormErrors.state ? "border-red-500" : "border-[var(--muted)]"
                        }`}
                      >
                        <option value="">Select state</option>
                        {MALAYSIA_STATES_WEST.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                        {MALAYSIA_STATES_EAST.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={addressForm.state ?? ""}
                        onChange={(e) => updateAddressForm("state", e.target.value)}
                        className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                          addressFormErrors.state ? "border-red-500" : "border-[var(--muted)]"
                        }`}
                      />
                    )}
                    {addressFormErrors.state && (
                      <p className="mt-1 text-xs text-red-500">{addressFormErrors.state[0]}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Postcode</label>
                    <input
                      value={addressForm.postcode ?? ""}
                      onChange={(e) => updateAddressForm("postcode", e.target.value)}
                      className={`w-full rounded border px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input ${
                        addressFormErrors.postcode ? "border-red-500" : "border-[var(--muted)]"
                      }`}
                    />
                    {addressFormErrors.postcode && (
                      <p className="mt-1 text-xs text-red-500">{addressFormErrors.postcode[0]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--foreground)]/70">Country</label>
                  <select
                    value={addressForm.country}
                    onChange={(e) => {
                      const nextCountry = e.target.value;
                      updateAddressForm("country", nextCountry);
                      if (normalizeCountryValue(nextCountry) !== "MY") {
                        updateAddressForm("state", "");
                      }
                    }}
                    className="w-full rounded border border-[var(--muted)] bg-[var(--card)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
          <div className="w-full max-w-lg rounded-lg bg-[var(--card)] p-5 text-[var(--foreground)] shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Apply Voucher</h3>
                <p className="mt-0.5 text-xs text-[var(--foreground)]/60">
                  Use a voucher code or pick from your claimed vouchers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherModal(false)}
                className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[var(--muted)]/70 bg-[var(--muted)]/10 p-4">
                <p className="text-xs font-semibold text-[var(--foreground)]/70">Voucher code</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => handleVoucherChange(e.target.value)}
                    placeholder="Enter voucher code"
                    className="w-full rounded border border-[var(--muted)] px-3 py-2 text-base outline-none focus:border-[var(--accent)] ios-input"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCodeVoucher}
                    disabled={isApplyingVoucher || !voucherCode.trim()}
                    className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApplyingVoucher ? "Applying..." : "Apply"}
                  </button>
                </div>
                {voucherErrorMessage && (
                  <p className="mt-2 text-xs text-[color:var(--status-error)]">{voucherErrorMessage}</p>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--foreground)]/60">
                <div className="h-px flex-1 bg-[var(--muted)]/60" />
                <span>Or choose from your vouchers</span>
                <div className="h-px flex-1 bg-[var(--muted)]/60" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--foreground)]">My Vouchers</p>
                </div>
                {loadingVouchers ? (
                  <p className="text-xs text-[var(--foreground)]/70">Loading vouchers...</p>
                ) : visibleVouchers.length === 0 ? (
                  <p className="text-xs text-[var(--foreground)]/60">No vouchers available.</p>
                ) : (
                  <VoucherList
                    vouchers={visibleVouchers}
                    selectedVoucherId={selectedVoucherId}
                    onSelectVoucher={setSelectedVoucherId}
                    onViewDetails={setDetailsVoucherId}
                    clearVoucherFeedback={clearVoucherFeedback}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleApplySelectedVoucher}
                disabled={isApplyingVoucher || !selectedVoucherId || !isSelectedVoucherEligible}
                className="w-full rounded bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingVoucher ? "Applying..." : "Apply Selected Voucher"}
              </button>
              {voucherMessage && !appliedVoucher && (
                <p className="text-xs text-[var(--foreground)]/70">{voucherMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
      <VoucherDetailsModal
        open={detailsVoucherId !== null}
        voucherId={detailsVoucherId}
        onClose={() => setDetailsVoucherId(null)}
      />
    </main>
    </>
  );
}
