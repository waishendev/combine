import { redirect } from 'next/navigation'

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy URL — forwards to /reports/sales/visual?mode=booking */
export default async function SalesVisualBookingRedirectPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {}
  const q = new URLSearchParams()
  q.set('mode', 'booking')
  for (const [key, val] of Object.entries(sp)) {
    if (key === 'mode') continue
    if (val === undefined) continue
    if (Array.isArray(val)) {
      val.forEach((v) => q.append(key, String(v)))
    } else {
      q.set(key, String(val))
    }
  }
  redirect(`/reports/sales/visual?${q.toString()}`)
}
