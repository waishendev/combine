import { Staff } from "@/lib/types";

type StaffSelectorProps = {
  staffs: Staff[];
  selectedStaffId: number | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onSelectStaff: (staffId: number) => void;
};

export function StaffSelector({
  staffs,
  selectedStaffId,
  loading,
  error,
  disabled,
  onSelectStaff,
}: StaffSelectorProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 2</p>
        <h2 className="mt-1 text-2xl font-medium text-neutral-900">Choose your staff</h2>
      </div>

      {disabled ? <p className="text-sm text-neutral-500">Select a service to view available staff.</p> : null}
      {loading ? <p className="text-sm text-neutral-500">Loading staff...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staffs.map((staff) => {
          const isActive = selectedStaffId === staff.id;
          return (
            <button
              type="button"
              key={staff.id}
              onClick={() => onSelectStaff(staff.id)}
              disabled={disabled}
              className={`rounded-2xl border p-4 text-left transition ${
                isActive
                  ? "border-amber-700 bg-amber-700 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <p className="text-base font-semibold">{staff.name}</p>
              <p className={`mt-1 text-sm ${isActive ? "text-white/80" : "text-neutral-500"}`}>
                {staff.bio || "Available for this service"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
