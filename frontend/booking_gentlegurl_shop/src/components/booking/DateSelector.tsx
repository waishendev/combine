type BookingDate = {
  value: string;
  dayName: string;
  dayNumber: string;
  monthName: string;
};

type DateSelectorProps = {
  dates: BookingDate[];
  selectedDate: string;
  disabled: boolean;
  onSelectDate: (date: string) => void;
};

export function DateSelector({ dates, selectedDate, disabled, onSelectDate }: DateSelectorProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 3</p>
        <h2 className="mt-1 text-2xl font-medium text-neutral-900">Choose your date</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => {
          const isActive = selectedDate === date.value;
          return (
            <button
              type="button"
              key={date.value}
              disabled={disabled}
              onClick={() => onSelectDate(date.value)}
              className={`min-w-[78px] rounded-xl border px-3 py-2 text-center transition ${
                isActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className={`text-[10px] uppercase tracking-[0.2em] ${isActive ? "text-white/70" : "text-neutral-500"}`}>
                {date.dayName}
              </p>
              <p className="text-xl font-medium">{date.dayNumber}</p>
              <p className={`text-[10px] uppercase tracking-[0.1em] ${isActive ? "text-white/70" : "text-neutral-500"}`}>
                {date.monthName}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
