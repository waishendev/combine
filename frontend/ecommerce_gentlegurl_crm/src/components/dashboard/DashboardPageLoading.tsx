export default function DashboardPageLoading() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center bg-gradient-to-b from-slate-100 via-slate-50/80 to-slate-100 px-4 py-20">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white/85 px-10 py-12 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(15,23,42,0.08)] backdrop-blur-[2px]">
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-violet-500/[0.06]"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-5">
          <div className="relative h-12 w-12">
            <div
              className="absolute inset-0 rounded-full border-2 border-slate-100 bg-slate-50/80"
              aria-hidden
            />
            <div
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-500 border-r-violet-400/70 [animation-duration:0.9s]"
              style={{ animationTimingFunction: 'cubic-bezier(0.5, 0.1, 0.4, 0.9)' }}
              aria-hidden
            />
            <div
              className="absolute inset-[5px] rounded-full bg-gradient-to-br from-white to-indigo-50/40"
              aria-hidden
            />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-500">Loading</p>
            <p className="mt-1.5 text-sm text-slate-600">Preparing dashboard…</p>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="crm-loading-dot h-1.5 w-1.5 rounded-full bg-indigo-500 [animation-delay:0ms]" />
            <span className="crm-loading-dot h-1.5 w-1.5 rounded-full bg-violet-500 [animation-delay:150ms]" />
            <span className="crm-loading-dot h-1.5 w-1.5 rounded-full bg-indigo-400 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  )
}
