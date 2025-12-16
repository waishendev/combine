import Link from "next/link";
import type { Cart, CartItem } from "@/lib/shop-types";

type CartSummaryProps = {
  cart: Cart | null;
  selectedItems?: CartItem[];
  onCheckout?: () => void;
};

export function CartSummary({ cart, selectedItems, onCheckout }: CartSummaryProps) {
  // 如果提供了选中的项目，计算选中项目的总价
  const calculateSelectedTotal = () => {
    if (!selectedItems || selectedItems.length === 0) {
      return null;
    }
    return selectedItems.reduce((sum, item) => sum + parseFloat(item.line_total.toString()), 0);
  };

  const selectedTotal = calculateSelectedTotal();
  const displaySubtotal = selectedTotal !== null ? selectedTotal : cart?.subtotal ?? 0;
  const displayDiscount = cart?.discount_total ?? 0;
  const displayShipping = cart?.shipping_fee ?? 0;
  const displayTotal = displaySubtotal - displayDiscount + displayShipping;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold">Order Summary</h3>
      {cart ? (
        <div className="space-y-2 text-sm text-slate-700">
          {selectedItems && selectedItems.length > 0 && selectedItems.length < (cart.items?.length ?? 0) && (
            <p className="mb-2 text-xs text-slate-500">
              {selectedItems.length} of {cart.items?.length ?? 0} items selected
            </p>
          )}
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>RM {displaySubtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Discount</span>
            <span>- RM {displayDiscount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping</span>
            <span>RM {displayShipping.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>RM {Math.max(0, displayTotal).toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Cart is empty.</p>
      )}
      {onCheckout ? (
        <button
          onClick={onCheckout}
          disabled={!cart || (selectedItems && selectedItems.length === 0)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {selectedItems && selectedItems.length > 0
            ? `Checkout ${selectedItems.length} item${selectedItems.length > 1 ? "s" : ""}`
            : "Proceed to Checkout"}
        </button>
      ) : (
        <Link
          href="/checkout"
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500"
        >
          Proceed to Checkout
        </Link>
      )}
    </div>
  );
}
