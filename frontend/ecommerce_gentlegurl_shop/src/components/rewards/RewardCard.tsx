"use client";

import Link from "next/link";
import { LoyaltyReward } from "@/lib/apiClient";

const PLACEHOLDER_IMAGE = "/images/placeholder.png";

interface RewardCardProps {
  reward: LoyaltyReward;
  availablePoints: number;
  isRedeeming: boolean;
  onRedeem: (reward: LoyaltyReward) => void;
  formatAmount: (value?: number | string | null) => string;
  getImageSrc: (imageSrc: string) => string;
  handleImageError: (imageSrc: string) => void;
  customer: any;
}

export function RewardCard({
  reward,
  availablePoints,
  isRedeeming,
  onRedeem,
  formatAmount,
  getImageSrc,
  handleImageError,
  customer,
}: RewardCardProps) {
  const isProduct = reward.type === "product";
  const imageUrl = reward.product?.image_url || reward.thumbnail || PLACEHOLDER_IMAGE;
  const hasEnoughPoints = availablePoints >= reward.points_required;
  const isAvailable = reward.is_available !== false;
  const shouldDisable = customer ? !hasEnoughPoints || !isAvailable || isRedeeming : !isAvailable || isRedeeming;
  const productLink = isProduct && reward.product?.slug ? `/product/${reward.product.slug}?reward=1` : null;

  const buttonLabel = !customer
    ? "Login to redeem"
    : isRedeeming
      ? "Redeeming..."
      : !isAvailable
        ? "Out of stock"
        : hasEnoughPoints
          ? "Redeem"
          : "Not enough points";

  const remainingLabel = isProduct
    ? `Stock left: ${reward.remaining ?? 0}`
    : reward.remaining == null
      ? "Remaining: Unlimited"
      : `Remaining: ${reward.remaining}`;

  const voucherBenefit = reward.voucher
    ? reward.voucher.type === "percent"
      ? `${reward.voucher.value}% off`
      : reward.voucher.value
        ? formatAmount(reward.voucher.value)
        : "Benefit available"
    : null;

  const contentSection = (
    <>
      {imageUrl && (
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-b from-[var(--background-soft)] to-[var(--card)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageSrc(imageUrl)}
            alt={reward.title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
            onError={() => handleImageError(imageUrl)}
          />
        </div>
      )}
      <div className="space-y-2 p-4">
        <h3 className="text-sm font-semibold leading-snug text-[var(--foreground)] md:text-base line-clamp-2">
          {reward.title}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--accent-strong)]">
            {reward.points_required.toLocaleString()} pts
          </span>
          {isProduct && (
            <span className="text-xs font-medium text-[color:var(--text-muted)]">
              {remainingLabel}
            </span>
          )}
        </div>

        {reward.description && (
          <p className="text-xs text-[color:var(--text-muted)] line-clamp-2">
            {reward.description}
          </p>
        )}

        {!isProduct && voucherBenefit && (
          <div className="space-y-1 text-xs text-[color:var(--text-muted)]">
            <p>Discount: {voucherBenefit}</p>
            <p>
              Min spend: {reward.voucher?.min_order_amount ? formatAmount(reward.voucher.min_order_amount) : "None"}
            </p>
          </div>
        )}

        {!isProduct && (
          <p className="text-xs font-medium text-[color:var(--text-muted)]">
            {remainingLabel}
          </p>
        )}

        {!isAvailable && (
          <span className="text-xs font-semibold text-[color:var(--status-error)]">
            {isProduct ? "Out of stock" : "Fully redeemed"}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 shadow-[0_12px_45px_-30px_rgba(17,24,39,0.65)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_-32px_rgba(109,40,217,0.35)]">
      {productLink ? (
        <Link href={productLink} className="block flex-1">
          {contentSection}
        </Link>
      ) : (
        <div className="flex-1">
          {contentSection}
        </div>
      )}

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRedeem(reward);
          }}
          disabled={shouldDisable}
          className={`w-full inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
            shouldDisable
              ? "cursor-not-allowed bg-[var(--muted)] text-[color:var(--text-muted)]"
              : "bg-[var(--accent-strong)] text-white shadow-sm hover:bg-[var(--accent-stronger)]"
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

