import Image from "next/image";
import { redirect } from "next/navigation";
import { getAccountOverview, type AccountOverview } from "@/lib/apiClient";

export default async function AccountPage() {
  let overview: AccountOverview | null = null;

  try {
    overview = await getAccountOverview();
  } catch {
    redirect("/login?redirect=/account");
  }

  if (!overview?.profile) {
    redirect("/login?redirect=/account");
  }

  const { profile, loyalty, addresses } = overview;
  const avatarUrl = profile.avatar ?? "/images/default_user_image.jpg";
  const availablePoints = loyalty.points.available ?? 0;
  const progressPercent = Math.min(Math.max(loyalty.spending.progress_percent, 0), 100);
  const nextTier = loyalty.spending.next_tier;
  const daysRemaining = loyalty.spending.days_remaining ?? loyalty.spending.window_months * 30;
  const amountToNextTier = loyalty.spending.amount_to_next_tier.toFixed(2);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border bg-white/60 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
              <Image
                src={avatarUrl}
                alt={profile.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{profile.name}</h2>
                <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-white">
                  {loyalty.current_tier.name}
                </span>
              </div>
              <p className="text-sm text-gray-600">{profile.email}</p>
              {profile.phone && <p className="text-sm text-gray-600">{profile.phone}</p>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-gray-600">
            {profile.gender && (
              <div className="flex justify-between">
                <span>Gender</span>
                <span className="font-medium capitalize">{profile.gender.toLowerCase()}</span>
              </div>
            )}
            {profile.date_of_birth && (
              <div className="flex justify-between">
                <span>Date of Birth</span>
                <span className="font-medium">{profile.date_of_birth}</span>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-white/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Loyalty Summary</h2>
            {loyalty.current_tier.badge_image_url && (
              <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                <Image
                  src={loyalty.current_tier.badge_image_url}
                  alt={`${loyalty.current_tier.name} badge`}
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="space-y-1 text-sm text-gray-700">
            <p className="flex items-center gap-2">
              <span className="text-gray-600">Current tier:</span>
              <span className="font-semibold text-gray-900">{loyalty.current_tier.name}</span>
            </p>
            <p className="text-xs text-gray-500">
              Multiplier: x{loyalty.current_tier.multiplier} • Min spend: RM {loyalty.current_tier.min_spend.toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Available Points</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{availablePoints}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Total Earned</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{loyalty.points.total_earned}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-pink-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-700">
              {nextTier ? (
                <>
                  Spend RM {amountToNextTier} more in next {daysRemaining} days to upgrade to {nextTier.name}
                </>
              ) : (
                "You are at the highest tier."
              )}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-white/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Saved Addresses</h2>
        </div>

        {addresses.length === 0 ? (
          <p className="text-sm text-gray-500">You have not added any shipping address yet.</p>
        ) : (
          <div className="space-y-4">
            {addresses.map((addr) => (
              <div key={addr.id} className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-medium">{addr.name}</div>
                  {addr.is_default && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Default</span>
                  )}
                </div>
                <div>{addr.phone}</div>
                <div className="mt-1">
                  {addr.line1}
                  {addr.line2 && `, ${addr.line2}`}
                </div>
                <div className="text-xs text-gray-500">
                  {addr.postcode} {addr.city}
                  {addr.state && `, ${addr.state}`}
                  {addr.country && `, ${addr.country}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
