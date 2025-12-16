import type { PromotionItem } from "@/lib/shop-types";

export function PromotionBox({ promotion }: { promotion: PromotionItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm">
      <div className="text-sm uppercase tracking-wide text-blue-700">Promotion</div>
      <h2 className="text-2xl font-semibold text-slate-900">{promotion.title}</h2>
      <p className="text-slate-700">{promotion.text}</p>
      {promotion.button_label && promotion.button_link ? (
        <a
          href={promotion.button_link}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
        >
          {promotion.button_label}
        </a>
      ) : null}
    </div>
  );
}
