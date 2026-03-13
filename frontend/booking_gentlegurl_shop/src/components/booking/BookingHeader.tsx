type BookingHeaderProps = {
  title: string;
  subtitle: string;
};

export function BookingHeader({ title, subtitle }: BookingHeaderProps) {
  return (
    <header className="text-center">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-700">Salon & Spa Booking</p>
      <h1 className="mt-3 text-4xl font-medium text-neutral-900 md:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-600 md:text-base">{subtitle}</p>
    </header>
  );
}
