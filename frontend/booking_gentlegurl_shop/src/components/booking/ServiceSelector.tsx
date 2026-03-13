import { Service } from "@/lib/types";

type ServiceSelectorProps = {
  services: Service[];
  selectedServiceId: number | null;
  loading: boolean;
  error: string | null;
  onSelectService: (serviceId: number) => void;
};

export function ServiceSelector({
  services,
  selectedServiceId,
  loading,
  error,
  onSelectService,
}: ServiceSelectorProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 1</p>
        <h2 className="mt-1 text-2xl font-medium text-neutral-900">Choose your service</h2>
      </div>

      {loading ? <p className="text-sm text-neutral-500">Loading services...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service, index) => {
          const isActive = selectedServiceId === service.id;

          return (
            <button
              type="button"
              key={service.id}
              onClick={() => onSelectService(service.id)}
              className={`group rounded-2xl border p-4 text-left transition ${
                isActive
                  ? "border-neutral-900 bg-neutral-900 text-white shadow"
                  : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 hover:bg-white"
              }`}
            >
              <p className={`text-3xl font-light ${isActive ? "text-white/60" : "text-neutral-300"}`}>
                {(index + 1).toString().padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-lg font-medium">{service.name}</h3>
              <p className={`mt-1 text-sm ${isActive ? "text-white/80" : "text-neutral-600"}`}>
                {service.duration_minutes} mins • Deposit RM {service.deposit_amount}
              </p>
              <p className={`mt-3 text-sm ${isActive ? "text-white/90" : "text-amber-700"}`}>RM {service.price}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
