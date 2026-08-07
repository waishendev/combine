"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import WalletBalanceSection from "@/components/account/WalletBalanceSection";
import InternationalPhoneInput from "@/components/common/InternationalPhoneInput";
import { normalizeInternationalPhone } from "@/lib/phone";
import type {
  AddressPayload,
  CustomerAddress,
  CustomerProfileWithAddresses,
  LoyaltySummary,
  UpdateCustomerProfilePayload,
} from "@/lib/apiClient";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  changeCustomerPassword,
  getAccountOverview,
  getCustomerProfile,
  makeDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
} from "@/lib/apiClient";

const emptyAddress: AddressPayload = {
  label: "",
  type: "shipping",
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postcode: "",
  country: "Malaysia",
  is_default: false,
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--muted)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--accent-strong)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-[var(--muted)] px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-[var(--status-error)]" aria-hidden="true">
      *
    </span>
  );
}

function FieldLabel({ children, required = true }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-[var(--accent-stronger)]">
      {children}
      {required ? <RequiredMark /> : null}
    </span>
  );
}

type ProfileFormState = {
  name: string;
  phone: string;
  gender: string;
  photo: File | null;
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

function formatGenderLabel(gender: string | null | undefined) {
  if (!gender) return "-";
  const match = GENDER_OPTIONS.find((option) => option.value === gender.toLowerCase());
  return match?.label ?? gender;
}

function formatDateOfBirth(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

type ChangePasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showCurrent: boolean;
  showNew: boolean;
  showConfirm: boolean;
};

type AddressFormState = AddressPayload;

type ApiErrorShape = {
  message?: string;
  errors?: Record<string, string[] | string>;
};

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfileWithAddresses | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: "",
    phone: "",
    gender: "",
    photo: null,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState<ChangePasswordFormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    showCurrent: false,
    showNew: false,
    showConfirm: false,
  });
  const [addressForm, setAddressForm] = useState<AddressFormState>({ ...emptyAddress });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addressModalError, setAddressModalError] = useState<string | null>(null);
  const [addressFormErrors, setAddressFormErrors] = useState<Record<string, string[]>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const avatarUrl = useMemo(
    () => profile?.avatar || "/images/default_user_image.jpg",
    [profile?.avatar],
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileResponse, overview] = await Promise.all([
          getCustomerProfile(),
          getAccountOverview(),
        ]);

        setProfile(profileResponse.data);
        setProfileForm((prev) => ({
          ...prev,
          name: profileResponse.data.name ?? "",
          phone: profileResponse.data.phone ?? "",
          gender: profileResponse.data.gender ?? "",
          photo: null,
        }));
        setLoyalty(overview?.loyalty ?? null);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          router.push("/login?redirect=/account");
          return;
        }
        setError("Failed to load account details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [router]);

  const refreshProfile = async () => {
    try {
      const response = await getCustomerProfile();
      setProfile(response.data);
      setProfileForm((prev) => ({
        ...prev,
        name: response.data.name ?? "",
        phone: response.data.phone ?? "",
        gender: response.data.gender ?? "",
        photo: null,
      }));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        router.push("/login?redirect=/account");
        return;
      }

      setError("Failed to refresh profile. Please try again.");
    }
  };

  const handleProfileSave = async () => {
    if (!profile) return;

    setSavingProfile(true);
    setFeedback(null);
    setError(null);

    const updatePayload: UpdateCustomerProfilePayload = {};

    if (profileForm.name.trim()) updatePayload.name = profileForm.name.trim();
    const normalizedPhone = normalizeInternationalPhone(profileForm.phone);
    if (normalizedPhone || profileForm.phone !== (profile.phone ?? "")) {
      updatePayload.phone = normalizedPhone || null;
    }
    if (profileForm.photo) updatePayload.photo = profileForm.photo;
    if (profileForm.gender !== (profile.gender ?? "")) {
      updatePayload.gender = profileForm.gender || null;
    }

    try {
      const response = await updateCustomerProfile(updatePayload);
      setProfile(response.data);
      setProfileModalOpen(false);
      setFeedback("Profile updated successfully.");
      setProfileForm((prev) => ({
        ...prev,
        photo: null,
        gender: response.data.gender ?? "",
      }));
      setPhotoPreview(null);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    setChangingPassword(true);
    setFeedback(null);
    setError(null);

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setChangingPassword(false);
      setError("Password confirmation does not match.");
      return;
    }

    try {
      await changeCustomerPassword({
        current_password: changePasswordForm.currentPassword,
        password: changePasswordForm.newPassword,
        password_confirmation: changePasswordForm.confirmPassword,
        type: "customer",
      });

      setFeedback("Password updated successfully.");
      setChangePasswordModalOpen(false);
      setChangePasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        showCurrent: false,
        showNew: false,
        showConfirm: false,
      });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const openAddressModal = (address?: CustomerAddress) => {
    setFeedback(null);
    setError(null);
    setAddressModalError(null);
    setAddressFormErrors({});

    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label ?? "",
        type: "shipping",
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
    } else {
      setEditingAddress(null);
      setAddressForm({ ...emptyAddress, type: "shipping" });
    }

    setAddressModalOpen(true);
  };

  const updateAddressField = <K extends keyof AddressFormState>(field: K, value: AddressFormState[K]) => {
    setAddressForm((prev) => ({ ...prev, [field]: value }));
    if (addressFormErrors[field as string]) {
      setAddressFormErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const handleAddressSave = async () => {
    setSavingAddress(true);
    setAddressModalError(null);
    setAddressFormErrors({});
    setFeedback(null);

    const normalizedAddressPhone = normalizeInternationalPhone(addressForm.phone);
    const payload: AddressPayload = {
      ...addressForm,
      type: "shipping",
      phone: normalizedAddressPhone,
      label: addressForm.label?.trim() || "",
      line2: addressForm.line2?.trim() || null,
      state: addressForm.state?.trim() || null,
      postcode: addressForm.postcode?.trim() || null,
    };

    try {
      if (editingAddress) {
        await updateCustomerAddress(editingAddress.id, payload);
      } else {
        await createCustomerAddress(payload);
      }

      await refreshProfile();
      setAddressModalOpen(false);
      setAddressModalError(null);
      setAddressFormErrors({});
      setFeedback(editingAddress ? "Address updated successfully." : "Address added successfully.");
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        setAddressFormErrors(fieldErrors);
        const apiMessage = (err as { data?: ApiErrorShape })?.data?.message;
        setAddressModalError(apiMessage || "Validation failed");
      } else {
        setAddressModalError(extractError(err));
      }
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await deleteCustomerAddress(addressId);
      await refreshProfile();
      setFeedback("Address deleted successfully.");
    } catch (err) {
      setError(extractError(err));
    }
  };

  const handleMakeDefault = async (addressId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await makeDefaultCustomerAddress(addressId);
      await refreshProfile();
      setFeedback("Default address updated.");
    } catch (err) {
      setError(extractError(err));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 text-center text-[var(--accent-strong)]">
        <p className="text-lg font-medium">Loading your account...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const progressPercent = loyalty
    ? Math.min(Math.max(loyalty.spending.progress_percent, 0), 100)
    : 0;
  const nextTier = loyalty?.spending.next_tier;
  const daysRemaining = loyalty?.spending.days_remaining ?? (loyalty?.spending.window_months ?? 0) * 30;
  const amountToNextTier = loyalty?.spending.amount_to_next_tier.toFixed(2);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--accent-stronger)] sm:text-2xl">My Account</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setError(null);
              setChangePasswordModalOpen(true);
            }}
            className="min-h-[44px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-xs font-semibold text-[var(--accent-strong)] shadow-sm transition hover:bg-[var(--background-soft)] sm:min-h-0 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="min-h-[44px] rounded-lg bg-[var(--accent)] px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] sm:min-h-0 sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--accent-stronger)]">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}


      <WalletBalanceSection workspaceType="ecommerce" />

      <div className="grid gap-4 sm:gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]/70 p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--background-soft)] ring-2 ring-[var(--muted)] sm:h-16 sm:w-16">
              <Image
                src={avatarUrl}
                alt={profile.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1 sm:space-y-2">
              <h2 className="break-words text-base font-semibold text-[var(--accent-stronger)] sm:text-lg">{profile.name}</h2>
              <p className="break-words text-sm text-[color:var(--text-muted)]">{profile.email}</p>
              {profile.phone && <p className="break-words text-sm text-[color:var(--text-muted)]">{profile.phone}</p>}
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-[color:var(--text-muted)] sm:mt-6">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--background-soft)] px-3 py-2.5">
              <span>Gender</span>
              <span className="font-medium text-[var(--foreground)]">{formatGenderLabel(profile.gender)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--background-soft)] px-3 py-2.5">
              <span>Date of Birth</span>
              <span className="font-medium text-[var(--foreground)]">{formatDateOfBirth(profile.date_of_birth)}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]/70 p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">Loyalty Summary</h2>
            {loyalty?.current_tier.badge_image_url && (
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--background-soft)]">
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

          {loyalty ? (
            <>
              <div className="space-y-1 text-sm text-[color:var(--text-muted)]">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[color:var(--text-muted)]">Current tier:</span>
                  <span className="font-semibold text-[var(--accent-stronger)]">{loyalty.current_tier.name}</span>
                </p>
                <p className="text-xs text-[color:var(--text-muted)]">
                  • Min spend: RM {loyalty.current_tier.min_spend.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:gap-4">
                <div className="rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] p-3">
                  <p className="text-xs text-[var(--accent-strong)]">Available Points</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--accent-stronger)] sm:text-xl">{loyalty.points.available}</p>
                </div>
                <div className="rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] p-3">
                  <p className="text-xs text-[var(--accent-strong)]">Total Earned</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--accent-stronger)] sm:text-xl">{loyalty.points.total_earned}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2 rounded-full bg-[var(--muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent-strong)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm leading-relaxed text-[color:var(--text-muted)]">
                  {nextTier ? (
                    <>
                      Spend RM {amountToNextTier} more in next {daysRemaining} days to upgrade to {nextTier.name}
                    </>
                  ) : (
                    "You are at the highest tier."
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">Loyalty summary is unavailable right now.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]/70 p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">Address Book</h2>
            <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Manage your shipping and billing details.</p>
          </div>
          <button
            type="button"
            onClick={() => openAddressModal()}
            className="min-h-[44px] w-full rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--muted)] sm:min-h-0 sm:w-auto sm:py-2"
          >
            Add Address
          </button>
        </div>

        {profile.addresses.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">You have not added any address yet.</p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {profile.addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] p-3.5 text-sm text-[color:var(--text-muted)] shadow-sm sm:p-4"
              >
                <div className="mb-2 flex flex-col gap-3 sm:mb-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="font-medium text-[var(--accent-stronger)]">{addr.label || "Address"}</div>
                    {addr.is_default && (
                      <span className="rounded-full bg-[var(--accent-stronger)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={() => openAddressModal(addr)}
                      className="min-h-[40px] rounded-md border border-[var(--muted)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] hover:bg-[var(--muted)] sm:min-h-0 sm:py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="min-h-[40px] rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 sm:min-h-0 sm:py-1"
                    >
                      Delete
                    </button>
                    {!addr.is_default && (
                      <button
                        type="button"
                        onClick={() => handleMakeDefault(addr.id)}
                        className="col-span-2 min-h-[40px] rounded-md border border-[var(--status-success-border)] px-3 py-2 text-xs font-semibold text-[color:var(--status-success)] hover:bg-[var(--status-success-bg)] sm:col-span-1 sm:min-h-0 sm:py-1"
                      >
                        Make Default
                      </button>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-[var(--accent-stronger)]">{addr.name}</div>
                <div className="text-sm text-[color:var(--text-muted)]">{addr.phone}</div>
                <div className="mt-1 text-sm leading-relaxed text-[color:var(--text-muted)]">
                  {addr.line1}
                  {addr.line2 && `, ${addr.line2}`}
                </div>
                <div className="text-xs text-[color:var(--text-muted)]">
                  {addr.postcode} {addr.city}
                  {addr.state && `, ${addr.state}`}
                  {addr.country && `, ${addr.country}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={profileModalOpen}
        title="Edit Profile"
        onClose={() => {
          setProfileModalOpen(false);
          setPhotoPreview(null);
        }}
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setProfileModalOpen(false);
                setPhotoPreview(null);
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[var(--muted)]/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingProfile ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full max-w-xs md:w-auto">
            <div className="space-y-3">
              <div className="h-48 w-full overflow-hidden rounded-lg border border-[var(--muted)] bg-[var(--background-soft)]">
                <Image
                  src={photoPreview || profile?.avatar || "/images/default_user_image.jpg"}
                  alt="Profile preview"
                  width={192}
                  height={192}
                  className="h-full w-full object-cover"
                />
              </div>
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setProfileForm({ ...profileForm, photo: file });
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPhotoPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setPhotoPreview(null);
                    }
                  }}
                  className="hidden"
                />
                <div className="w-full rounded-lg border border-[var(--muted)] bg-[var(--background-soft)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--muted)]">
                  Upload Photo
                </div>
              </label>
              <p className="text-xs text-[color:var(--text-muted)] text-center">
                Upload a new photo to update your avatar.
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--accent-stronger)]">Name</span>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--accent-stronger)]">Phone</span>
              <InternationalPhoneInput
                value={profileForm.phone}
                onChange={(phone) => setProfileForm({ ...profileForm, phone })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--accent-stronger)]">Gender</span>
              <select
                value={profileForm.gender}
                onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="block space-y-1 text-sm">
              <span className="text-[var(--accent-stronger)]">Date of Birth</span>
              <p className="rounded-lg border border-[var(--input-border)] bg-[var(--background-soft)] px-3 py-2 text-sm text-[color:var(--text-muted)]">
                {formatDateOfBirth(profile.date_of_birth)}
              </p>
              <p className="text-xs text-[color:var(--text-muted)]">Date of birth cannot be changed after registration.</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={changePasswordModalOpen}
        title="Change Password"
        onClose={() => {
          setChangePasswordModalOpen(false);
          setChangePasswordForm({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
            showCurrent: false,
            showNew: false,
            showConfirm: false,
          });
        }}
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setChangePasswordModalOpen(false);
                setChangePasswordForm({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                  showCurrent: false,
                  showNew: false,
                  showConfirm: false,
                });
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[var(--muted)]/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={changingPassword}
              className="rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="currentPassword">
              Current Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/45">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  <path d="M6 11h12v10H6z" />
                </svg>
              </div>
              <input
                id="currentPassword"
                type={changePasswordForm.showCurrent ? "text" : "password"}
                value={changePasswordForm.currentPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })
                }
                className="w-full rounded-xl border bg-[var(--card)]/90 px-3 py-2.5 pl-10 pr-12 text-sm text-[var(--foreground)] border-[var(--input-border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                placeholder="Current password"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() =>
                    setChangePasswordForm((prev) => ({ ...prev, showCurrent: !prev.showCurrent }))
                  }
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-[var(--background-soft)] hover:text-[var(--accent-strong)]"
                  aria-label={changePasswordForm.showCurrent ? "Hide current password" : "Show current password"}
                >
                  {changePasswordForm.showCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="newPassword">
              New Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/45">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  <path d="M6 11h12v10H6z" />
                </svg>
              </div>
              <input
                id="newPassword"
                type={changePasswordForm.showNew ? "text" : "password"}
                value={changePasswordForm.newPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })
                }
                className="w-full rounded-xl border bg-[var(--card)]/90 px-3 py-2.5 pl-10 pr-12 text-sm text-[var(--foreground)] border-[var(--input-border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                placeholder="New password"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() => setChangePasswordForm((prev) => ({ ...prev, showNew: !prev.showNew }))}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-[var(--background-soft)] hover:text-[var(--accent-strong)]"
                  aria-label={changePasswordForm.showNew ? "Hide new password" : "Show new password"}
                >
                  {changePasswordForm.showNew ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]/80" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/45">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  <path d="M6 11h12v10H6z" />
                </svg>
              </div>
              <input
                id="confirmPassword"
                type={changePasswordForm.showConfirm ? "text" : "password"}
                value={changePasswordForm.confirmPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })
                }
                className="w-full rounded-xl border bg-[var(--card)]/90 px-3 py-2.5 pl-10 pr-12 text-sm text-[var(--foreground)] border-[var(--input-border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--ring)]/25"
                placeholder="Confirm new password"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  onClick={() =>
                    setChangePasswordForm((prev) => ({ ...prev, showConfirm: !prev.showConfirm }))
                  }
                  className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-[var(--background-soft)] hover:text-[var(--accent-strong)]"
                  aria-label={changePasswordForm.showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {changePasswordForm.showConfirm ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={addressModalOpen}
        title={editingAddress ? "Edit Address" : "Add Address"}
        onClose={() => {
          setAddressModalOpen(false);
          setAddressModalError(null);
          setAddressFormErrors({});
        }}
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setAddressModalOpen(false);
                setAddressModalError(null);
                setAddressFormErrors({});
              }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[var(--muted)]/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddressSave}
              disabled={savingAddress}
              className="rounded-md bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingAddress ? "Saving..." : editingAddress ? "Update" : "Save"}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          {addressModalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {addressModalError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <FieldLabel>Label</FieldLabel>
              <input
                type="text"
                value={addressForm.label ?? ""}
                onChange={(e) => updateAddressField("label", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.label
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
                placeholder="e.g. Home"
              />
              {addressFormErrors.label?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.label[0]}</p>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <FieldLabel required={false}>Type</FieldLabel>
              <select
                value="shipping"
                disabled
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/30 px-3 py-2 text-sm text-[var(--foreground)]/80"
              >
                <option value="shipping">Shipping</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <FieldLabel>Recipient Name</FieldLabel>
              <input
                type="text"
                value={addressForm.name}
                onChange={(e) => updateAddressField("name", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.name
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
              />
              {addressFormErrors.name?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.name[0]}</p>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <FieldLabel>Phone</FieldLabel>
              <InternationalPhoneInput
                value={addressForm.phone}
                onChange={(phone) => updateAddressField("phone", phone)}
                error={Boolean(addressFormErrors.phone)}
              />
              {addressFormErrors.phone?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.phone[0]}</p>
              ) : null}
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">

          <label className="space-y-1 text-sm">
            <FieldLabel>Address Line 1</FieldLabel>
            <input
              type="text"
              value={addressForm.line1}
              onChange={(e) => updateAddressField("line1", e.target.value)}
              className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                addressFormErrors.line1
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
              }`}
            />
            {addressFormErrors.line1?.[0] ? (
              <p className="text-xs text-red-600">{addressFormErrors.line1[0]}</p>
            ) : null}
          </label>

          <label className="space-y-1 text-sm">
            <FieldLabel required={false}>Address Line 2 (Optional)</FieldLabel>
            <input
              type="text"
              value={addressForm.line2 ?? ""}
              onChange={(e) => updateAddressField("line2", e.target.value)}
              className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                addressFormErrors.line2
                  ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
              }`}
            />
            {addressFormErrors.line2?.[0] ? (
              <p className="text-xs text-red-600">{addressFormErrors.line2[0]}</p>
            ) : null}
          </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <FieldLabel>City</FieldLabel>
              <input
                type="text"
                value={addressForm.city}
                onChange={(e) => updateAddressField("city", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.city
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
              />
              {addressFormErrors.city?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.city[0]}</p>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <FieldLabel>State</FieldLabel>
              <input
                type="text"
                value={addressForm.state ?? ""}
                onChange={(e) => updateAddressField("state", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.state
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
              />
              {addressFormErrors.state?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.state[0]}</p>
              ) : null}
            </label>
            <label className="space-y-1 text-sm">
              <FieldLabel>Postcode</FieldLabel>
              <input
                type="text"
                value={addressForm.postcode ?? ""}
                onChange={(e) => updateAddressField("postcode", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.postcode
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
              />
              {addressFormErrors.postcode?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.postcode[0]}</p>
              ) : null}
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <FieldLabel>Country</FieldLabel>
              <input
                type="text"
                value={addressForm.country}
                onChange={(e) => updateAddressField("country", e.target.value)}
                className={`w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  addressFormErrors.country
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-[var(--input-border)] focus:border-[var(--accent-strong)] focus:ring-[var(--ring)]/20"
                }`}
              />
              {addressFormErrors.country?.[0] ? (
                <p className="text-xs text-red-600">{addressFormErrors.country[0]}</p>
              ) : null}
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm text-[var(--accent-stronger)]">
              <input
                type="checkbox"
                checked={!!addressForm.is_default}
                onChange={(e) => updateAddressField("is_default", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--muted)] text-[var(--accent-strong)] focus:ring-[var(--accent-strong)]"
              />
              Set as default address
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function extractFieldErrors(error: unknown): Record<string, string[]> {
  const apiError = error as { data?: ApiErrorShape };
  const errors = apiError?.data?.errors;
  if (!errors || typeof errors !== "object") return {};

  const formatted: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      formatted[key] = value;
    } else if (typeof value === "string") {
      formatted[key] = [value];
    }
  }
  return formatted;
}

function extractError(error: unknown) {
  const apiError = error as { data?: ApiErrorShape; status?: number };
  if (apiError?.data) {
    const errors = apiError.data.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors)[0];
      if (Array.isArray(first)) {
        return first[0];
      }
      if (typeof first === "string") return first;
    }
    if (apiError.data.message) return apiError.data.message;
  }

  return "Something went wrong. Please try again.";
}
