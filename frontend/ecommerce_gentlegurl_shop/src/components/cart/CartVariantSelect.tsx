"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NameStack } from "@/components/common/NameStack";

type CartVariantOption = {
  id: number;
  name: string;
  cn_name?: string | null;
  sku?: string | null;
  stock?: number | null;
  derived_available_qty?: number | null;
  track_stock?: boolean | null;
  is_active?: boolean | null;
  is_bundle?: boolean | null;
};

type CartVariantSelectProps = {
  itemId: number;
  variants: CartVariantOption[];
  value: number | null;
  disabled?: boolean;
  updating?: boolean;
  productName?: string | null;
  className?: string;
  onChange: (variantId: number) => void;
};

function variantHasSellableStock(
  trackStock: boolean | null | undefined,
  stock: number | null | undefined,
) {
  if (!(trackStock ?? true)) return true;
  if (stock === null || stock === undefined) return true;
  return typeof stock === "number" && Number.isFinite(stock) && stock > 0;
}

export default function CartVariantSelect({
  itemId,
  variants,
  value,
  disabled = false,
  updating = false,
  productName,
  className = "",
  onChange,
}: CartVariantSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [useSheet, setUseSheet] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selected = variants.find((variant) => variant.id === value) ?? null;
  const isDisabled = disabled || updating || variants.length === 0;
  const displayName = selected?.name ?? (updating ? "Updating..." : "Select");
  const displayCnName = selected?.cn_name ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const syncSheetMode = () => setUseSheet(mediaQuery.matches);

    syncSheetMode();
    mediaQuery.addEventListener("change", syncSheetMode);
    return () => mediaQuery.removeEventListener("change", syncSheetMode);
  }, []);

  useLayoutEffect(() => {
    if (!open || useSheet) {
      setMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const maxHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < maxHeight + 12 && spaceAbove > spaceBelow;

      setMenuStyle({
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxHeight, openUp ? spaceAbove - 12 : spaceBelow - 12),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, useSheet, variants.length]);

  useEffect(() => {
    if (!open || !useSheet || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, useSheet]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(`[data-cart-variant-select="${itemId}"]`)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, itemId]);

  const renderOptions = () =>
    variants.map((variant) => {
      const availableQty = variant.is_bundle ? variant.derived_available_qty ?? 0 : variant.stock ?? 0;
      const outOfStock = (variant.track_stock ?? true) && availableQty <= 0;
      const optionDisabled = !variant.is_active || outOfStock;
      const isSelected = variant.id === value;

      return (
        <button
          key={variant.id}
          type="button"
          disabled={optionDisabled}
          onClick={() => {
            setOpen(false);
            onChange(variant.id);
          }}
          className={`block w-full border-b border-[var(--card-border)]/60 px-3 py-3 text-left last:border-b-0 sm:px-2.5 sm:py-2 ${
            isSelected
              ? "bg-[var(--accent-soft)]"
              : optionDisabled
                ? "cursor-not-allowed bg-[var(--background-soft)] opacity-60"
                : "hover:bg-[var(--background-soft)] active:bg-[var(--accent-soft)]/40"
          }`}
        >
          <NameStack
            name={variant.name}
            cnName={variant.cn_name ?? null}
            nameClassName="text-sm font-semibold text-[var(--foreground)] sm:text-xs"
            cnClassName="mt-0.5 text-xs text-[color:var(--text-muted)] sm:text-[11px]"
          />
          {variant.sku ? (
            <p className="mt-1 break-all text-xs font-mono text-[var(--foreground)]/50 sm:text-[11px]">{variant.sku}</p>
          ) : null}
          {outOfStock ? <p className="mt-1 text-[10px] font-bold text-[color:var(--status-error)]">Out of Stock</p> : null}
        </button>
      );
    });

  const sheetPortal =
    open && useSheet && variants.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close variant picker"
              className="fixed inset-0 z-[120] bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-[121] flex max-h-[min(72vh,560px)] flex-col rounded-t-2xl border border-[var(--card-border)] bg-[var(--card)] shadow-2xl"
              data-cart-variant-select={itemId}
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--foreground)]">Select</p>
                  {productName ? <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{productName}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-[var(--foreground)]/40 transition-colors hover:bg-[var(--background-soft)] hover:text-[var(--foreground)]"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <div className="overflow-y-auto overscroll-contain px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {renderOptions()}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  const menuPortal =
    open && !useSheet && menuStyle && variants.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <div
            data-cart-variant-select={itemId}
            style={{
              position: "fixed",
              left: menuStyle.left,
              width: menuStyle.width,
              top: menuStyle.top,
              bottom: menuStyle.bottom,
              maxHeight: menuStyle.maxHeight,
              zIndex: 120,
            }}
            className="overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--card)] shadow-lg"
          >
            {renderOptions()}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`relative ${className}`} data-cart-variant-select={itemId}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (isDisabled) return;
            setOpen((current) => !current);
          }}
          disabled={isDisabled}
          className={`inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-xs transition ${
            isDisabled
              ? "cursor-not-allowed border-[var(--card-border)] bg-[var(--background-soft)] text-[var(--foreground)]/40"
              : "border-[var(--card-border)] bg-[var(--muted)]/15 text-[var(--foreground)]/80 hover:border-[var(--accent)] hover:bg-[var(--card)] active:bg-[var(--background-soft)]"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-[var(--foreground)]">{displayName}</span>
            {displayCnName ? (
              <span className="mt-0.5 block truncate text-[11px] text-[color:var(--text-muted)]">{displayCnName}</span>
            ) : null}
          </span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-[var(--foreground)]/45 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {sheetPortal}
      {menuPortal}
    </>
  );
}
