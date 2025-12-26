'use client'

import { FormEvent, useEffect, useState } from 'react'

type ShopSettingsResponse = {
  data?: {
    shop_contact_widget?: {
      whatsapp?: {
        enabled?: boolean
        phone?: string
        default_message?: string
      }
    }
    homepage_products?: {
      new_products_days?: number
      best_sellers_days?: number
    }
    shipping?: {
      enabled?: boolean
      flat_fee?: number
      currency?: string
      label?: string
    }
  }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const defaultContactSettings = {
  enabled: false,
  phone: '',
  default_message: '',
}

const defaultHomepageSettings = {
  new_products_days: 30,
  best_sellers_days: 60,
}

const defaultShippingSettings = {
  enabled: false,
  flat_fee: 0,
  currency: 'MYR',
  label: '',
}

type ShopSettingsPageContentProps = {
  canEdit: boolean
}

export default function ShopSettingsPageContent({ canEdit }: ShopSettingsPageContentProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [contactSettings, setContactSettings] = useState(defaultContactSettings)
  const [homepageSettings, setHomepageSettings] = useState(defaultHomepageSettings)
  const [shippingSettings, setShippingSettings] = useState(defaultShippingSettings)

  const [contactSaveState, setContactSaveState] = useState<SaveState>('idle')
  const [homepageSaveState, setHomepageSaveState] = useState<SaveState>('idle')
  const [shippingSaveState, setShippingSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    const controller = new AbortController()

    const fetchSettings = async () => {
      try {
        setError(null)
        const response = await fetch('/api/ecommerce/shop-settings', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load settings')
        }

        const payload: ShopSettingsResponse = await response.json()
        const contact = payload.data?.shop_contact_widget?.whatsapp ?? defaultContactSettings
        const homepage = payload.data?.homepage_products ?? defaultHomepageSettings
        const shipping = payload.data?.shipping ?? defaultShippingSettings

        setContactSettings({
          enabled: contact.enabled ?? false,
          phone: contact.phone ?? '',
          default_message: contact.default_message ?? '',
        })

        setHomepageSettings({
          new_products_days: homepage.new_products_days ?? defaultHomepageSettings.new_products_days,
          best_sellers_days: homepage.best_sellers_days ?? defaultHomepageSettings.best_sellers_days,
        })

        setShippingSettings({
          enabled: shipping.enabled ?? false,
          flat_fee: shipping.flat_fee ?? defaultShippingSettings.flat_fee,
          currency: shipping.currency ?? defaultShippingSettings.currency,
          label: shipping.label ?? defaultShippingSettings.label,
        })
      } catch (err) {
        if (controller.signal.aborted) return
        console.error(err)
        setError('Unable to fetch shop settings. Please try again.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchSettings()

    return () => controller.abort()
  }, [])

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setContactSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/shop_contact_widget', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          whatsapp: {
            enabled: contactSettings.enabled,
            phone: contactSettings.phone,
            default_message: contactSettings.default_message,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save contact widget settings')
      }

      setContactSaveState('saved')
    } catch (err) {
      console.error(err)
      setContactSaveState('error')
      setError('Unable to save WhatsApp contact widget settings.')
    } finally {
      setTimeout(() => setContactSaveState('idle'), 2000)
    }
  }

  const handleHomepageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setHomepageSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/homepage_products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_products_days: Number(homepageSettings.new_products_days) || 0,
          best_sellers_days: Number(homepageSettings.best_sellers_days) || 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save homepage product settings')
      }

      setHomepageSaveState('saved')
    } catch (err) {
      console.error(err)
      setHomepageSaveState('error')
      setError('Unable to save homepage product settings.')
    } finally {
      setTimeout(() => setHomepageSaveState('idle'), 2000)
    }
  }

  const handleShippingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setShippingSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/shipping', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: shippingSettings.enabled,
          flat_fee: Number(shippingSettings.flat_fee) || 0,
          currency: shippingSettings.currency,
          label: shippingSettings.label,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save shipping settings')
      }

      setShippingSaveState('saved')
    } catch (err) {
      console.error(err)
      setShippingSaveState('error')
      setError('Unable to save shipping settings.')
    } finally {
      setTimeout(() => setShippingSaveState('idle'), 2000)
    }
  }

  const renderSaveLabel = (state: SaveState) => {
    switch (state) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved'
      case 'error':
        return 'Retry'
      default:
        return 'Save Changes'
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading shop settings...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Contact Widget</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">WhatsApp Contact Widget</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Control the WhatsApp button that appears on the storefront. Configure the phone number and default greeting customers will see when they start a chat.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleContactSubmit}>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable WhatsApp Button</p>
              <p className="text-xs text-slate-500">Toggle to show or hide the floating WhatsApp contact button.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={contactSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setContactSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              <div
                className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500"
              >
                <span
                  className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]"
                />
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">Phone Number</span>
              <input
                type="text"
                value={contactSettings.phone}
                disabled={!canEdit}
                onChange={(event) =>
                  setContactSettings((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="e.g. +60123456789"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="block text-sm font-medium text-slate-800">Default Message</span>
              <textarea
                value={contactSettings.default_message}
                disabled={!canEdit}
                onChange={(event) =>
                  setContactSettings((prev) => ({ ...prev, default_message: event.target.value }))
                }
                rows={3}
                placeholder="Hi, I would like to ask about your products."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || contactSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(contactSaveState)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Homepage Products</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Homepage Product Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Set the time window for highlighting new products and best sellers on the storefront homepage.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleHomepageSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">New Products Days</span>
              <input
                type="number"
                min={0}
                value={homepageSettings.new_products_days}
                disabled={!canEdit}
                onChange={(event) =>
                  setHomepageSettings((prev) => ({ ...prev, new_products_days: Number(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">Best Sellers Days</span>
              <input
                type="number"
                min={0}
                value={homepageSettings.best_sellers_days}
                disabled={!canEdit}
                onChange={(event) =>
                  setHomepageSettings((prev) => ({ ...prev, best_sellers_days: Number(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || homepageSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(homepageSaveState)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Shipping</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Shipping Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Configure your shipping options and fees displayed to shoppers during checkout.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleShippingSubmit}>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable Shipping</p>
              <p className="text-xs text-slate-500">Toggle to enable flat-rate shipping on your shop.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={shippingSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">Flat Fee</span>
              <input
                type="number"
                min={0}
                value={shippingSettings.flat_fee}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, flat_fee: Number(event.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">Currency</span>
              <select
                value={shippingSettings.currency}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, currency: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="MYR">MYR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
                <option value="IDR">IDR</option>
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="block text-sm font-medium text-slate-800">Label (Optional)</span>
              <input
                type="text"
                value={shippingSettings.label}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="e.g. Flat Rate Shipping"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || shippingSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(shippingSaveState)}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
