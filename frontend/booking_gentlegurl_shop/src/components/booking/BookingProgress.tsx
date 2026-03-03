export function BookingProgress({ step }: { step: number }) {
  const steps = ["Service", "Staff", "Slot", "Checkout"];
  return (
    <div className="mb-6 grid grid-cols-4 gap-2 text-xs md:text-sm">
      {steps.map((label, index) => {
        const active = index + 1 <= step;
        return (
          <div key={label} className={`rounded-full px-3 py-2 text-center ${active ? "bg-black text-white" : "bg-neutral-100 text-neutral-500"}`}>
            {label}
          </div>
        );
      })}
    </div>
  );
}
