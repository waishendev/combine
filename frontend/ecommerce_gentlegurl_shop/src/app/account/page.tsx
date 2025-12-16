"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      <div className="w-full max-w-xl rounded-xl border border-pink-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-pink-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-pink-700">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-pink-600 transition hover:bg-pink-50"
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
        {footer && <div className="border-t border-pink-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

type ProfileFormState = {
  name: string;
  phone: string;
  photo: File | null;
};

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
    updatePayload.phone = profileForm.phone.trim() ? profileForm.phone.trim() : null;
    if (profileForm.photo) updatePayload.photo = profileForm.photo;

    try {
      const response = await updateCustomerProfile(updatePayload);
      setProfile(response.data);
      setProfileModalOpen(false);
      setFeedback("Profile updated successfully.");
      setProfileForm((prev) => ({ ...prev, photo: null }));
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

    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label ?? "",
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
    } else {
      setEditingAddress(null);
      setAddressForm({ ...emptyAddress });
    }

    setAddressModalOpen(true);
  };

  const handleAddressSave = async () => {
    setSavingAddress(true);
    setError(null);
    setFeedback(null);

    const payload: AddressPayload = {
      ...addressForm,
      label: addressForm.label?.trim() || null,
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
      setFeedback(editingAddress ? "Address updated successfully." : "Address added successfully.");
    } catch (err) {
      setError(extractError(err));
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
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 text-center text-pink-700">
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-pink-800">My Account</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setError(null);
              setChangePasswordModalOpen(true);
            }}
            className="rounded-lg border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm transition hover:bg-pink-50"
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-800">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)]">
        <section className="rounded-xl border border-pink-200 bg-white/70 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-pink-50 ring-2 ring-pink-200">
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
                <h2 className="text-lg font-semibold text-pink-900">{profile.name}</h2>
                {/* <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-pink-700">
                  {profile.tier}
                </span> */}
              </div>
              <p className="text-sm text-gray-700">{profile.email}</p>
              {profile.phone && <p className="text-sm text-gray-700">{profile.phone}</p>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm text-gray-700">
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

        <section className="flex flex-col gap-4 rounded-xl border border-pink-200 bg-white/70 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-700">Loyalty Summary</h2>
            {loyalty?.current_tier.badge_image_url && (
              <div className="h-8 w-8 overflow-hidden rounded-full bg-pink-50">
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
              <div className="space-y-1 text-sm text-gray-800">
                <p className="flex items-center gap-2">
                  <span className="text-gray-600">Current tier:</span>
                  <span className="font-semibold text-pink-800">{loyalty.current_tier.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Multiplier: x{loyalty.current_tier.multiplier} • Min spend: RM {loyalty.current_tier.min_spend.toFixed(2)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-pink-100 bg-pink-50 p-3">
                  <p className="text-xs text-pink-700">Available Points</p>
                  <p className="mt-1 text-xl font-semibold text-pink-900">{loyalty.points.available}</p>
                </div>
                <div className="rounded-lg border border-pink-100 bg-pink-50 p-3">
                  <p className="text-xs text-pink-700">Total Earned</p>
                  <p className="mt-1 text-xl font-semibold text-pink-900">{loyalty.points.total_earned}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-2 rounded-full bg-pink-100">
                  <div
                    className="h-2 rounded-full bg-pink-500"
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
            </>
          ) : (
            <p className="text-sm text-gray-500">Loyalty summary is unavailable right now.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-pink-200 bg-white/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-700">Address Book</h2>
            <p className="text-xs text-gray-600">Manage your shipping and billing details.</p>
          </div>
          <button
            type="button"
            onClick={() => openAddressModal()}
            className="rounded-lg border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-100"
          >
            Add Address
          </button>
        </div>

        {profile.addresses.length === 0 ? (
          <p className="text-sm text-gray-500">You have not added any address yet.</p>
        ) : (
          <div className="space-y-4">
            {profile.addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-lg border border-pink-200 bg-pink-50 p-4 text-sm text-gray-800 shadow-sm"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-pink-900">{addr.label || "Address"}</div>
                    {/* <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pink-700">
                      {addr.type}
                    </span> */}
                    {addr.is_default && (
                      <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAddressModal(addr)}
                      className="rounded-md border border-pink-200 px-3 py-1 text-xs font-semibold text-pink-700 hover:bg-pink-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                    {!addr.is_default && (
                      <button
                        type="button"
                        onClick={() => handleMakeDefault(addr.id)}
                        className="rounded-md border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Make Default
                      </button>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-pink-900">{addr.name}</div>
                <div className="text-sm text-gray-700">{addr.phone}</div>
                <div className="mt-1 text-sm text-gray-800">
                  {addr.line1}
                  {addr.line2 && `, ${addr.line2}`}
                </div>
                <div className="text-xs text-gray-600">
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
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={savingProfile}
              className="rounded-md bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingProfile ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="w-full max-w-xs md:w-auto">
            <div className="space-y-3">
              <div className="h-48 w-full overflow-hidden rounded-lg border border-pink-200 bg-pink-50">
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
                <div className="w-full rounded-lg border border-pink-300 bg-pink-50 px-4 py-2 text-center text-sm font-semibold text-pink-700 transition hover:bg-pink-100">
                  Upload Photo
                </div>
              </label>
              <p className="text-xs text-gray-600 text-center">
                Upload a new photo to update your avatar.
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-pink-800">Name</span>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-pink-800">Phone</span>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
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
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={changingPassword}
              className="rounded-md bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-pink-800">Current Password</span>
            <div className="flex gap-2">
              <input
                type={changePasswordForm.showCurrent ? "text" : "password"}
                value={changePasswordForm.currentPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })
                }
                className="flex-1 rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                placeholder="Current password"
              />
              <button
                type="button"
                onClick={() =>
                  setChangePasswordForm((prev) => ({ ...prev, showCurrent: !prev.showCurrent }))
                }
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-pink-50 hover:text-[var(--accent-strong)]"
              >
                {changePasswordForm.showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-pink-800">New Password</span>
            <div className="flex gap-2">
              <input
                type={changePasswordForm.showNew ? "text" : "password"}
                value={changePasswordForm.newPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })
                }
                className="flex-1 rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setChangePasswordForm((prev) => ({ ...prev, showNew: !prev.showNew }))}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-pink-50 hover:text-[var(--accent-strong)]"
              >
                {changePasswordForm.showNew ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-pink-800">Confirm Password</span>
            <div className="flex gap-2">
              <input
                type={changePasswordForm.showConfirm ? "text" : "password"}
                value={changePasswordForm.confirmPassword}
                onChange={(e) =>
                  setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })
                }
                className="flex-1 rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() =>
                  setChangePasswordForm((prev) => ({ ...prev, showConfirm: !prev.showConfirm }))
                }
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--foreground)]/60 hover:bg-pink-50 hover:text-[var(--accent-strong)]"
              >
                {changePasswordForm.showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </label>
        </div>
      </Modal>

      <Modal
        open={addressModalOpen}
        title={editingAddress ? "Edit Address" : "Add Address"}
        onClose={() => setAddressModalOpen(false)}
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setAddressModalOpen(false)}
              className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddressSave}
              disabled={savingAddress}
              className="rounded-md bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingAddress ? "Saving..." : editingAddress ? "Update" : "Save"}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Label</span>
              <input
                type="text"
                value={addressForm.label ?? ""}
                onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                placeholder="e.g. Home"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Type</span>
              <select
                value={addressForm.type}
                onChange={(e) => setAddressForm({ ...addressForm, type: e.target.value as AddressFormState["type"] })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              >
                <option value="shipping">Shipping</option>
                {/* <option value="billing">Billing</option> */}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Recipient Name</span>
              <input
                type="text"
                value={addressForm.name}
                onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Phone</span>
              <input
                type="text"
                value={addressForm.phone}
                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">

          <label className="space-y-1 text-sm">
            <span className="text-pink-800">Address Line 1</span>
            <input
              type="text"
              value={addressForm.line1}
              onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
              className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-pink-800">Address Line 2</span>
            <input
              type="text"
              value={addressForm.line2 ?? ""}
              onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
              className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
            />
          </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">City</span>
              <input
                type="text"
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">State</span>
              <input
                type="text"
                value={addressForm.state ?? ""}
                onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Postcode</span>
              <input
                type="text"
                value={addressForm.postcode ?? ""}
                onChange={(e) => setAddressForm({ ...addressForm, postcode: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-pink-800">Country</span>
              <input
                type="text"
                value={addressForm.country}
                onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                className="w-full rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm text-pink-800">
              <input
                type="checkbox"
                checked={!!addressForm.is_default}
                onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                className="h-4 w-4 rounded border-pink-300 text-pink-600 focus:ring-pink-400"
              />
              Set as default address
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
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
