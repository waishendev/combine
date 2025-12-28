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
    footer?: {
      enabled?: boolean
      about_text?: string | null
      contact?: {
        whatsapp?: string | null
        email?: string | null
        address?: string | null
      }
      social?: {
        instagram?: string | null
        facebook?: string | null
        tiktok?: string | null
      }
      links?: {
        shipping_policy?: string | null
        return_refund?: string | null
        privacy?: string | null
        terms?: string | null
      }
    }
    page_reviews?: {
      enabled?: boolean
    }
    product_reviews?: {
      enabled?: boolean
      review_window_days?: number
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

const defaultFooterSettings = {
  enabled: false,
  about_text: '',
  contact: {
    whatsapp: '',
    email: '',
    address: '',
  },
  social: {
    instagram: '',
    facebook: '',
    tiktok: '',
  },
  links: {
    shipping_policy: '',
    return_refund: '',
    privacy: '',
    terms: '',
  },
}

const defaultPageReviewsSettings = {
  enabled: false,
}

const defaultProductReviewsSettings = {
  enabled: false,
  review_window_days: 30,
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
  const [footerSettings, setFooterSettings] = useState(defaultFooterSettings)
  const [pageReviewsSettings, setPageReviewsSettings] = useState(defaultPageReviewsSettings)
  const [productReviewsSettings, setProductReviewsSettings] = useState(defaultProductReviewsSettings)

  const [contactSaveState, setContactSaveState] = useState<SaveState>('idle')
  const [homepageSaveState, setHomepageSaveState] = useState<SaveState>('idle')
  const [shippingSaveState, setShippingSaveState] = useState<SaveState>('idle')
  const [footerSaveState, setFooterSaveState] = useState<SaveState>('idle')
  const [pageReviewsSaveState, setPageReviewsSaveState] = useState<SaveState>('idle')
  const [productReviewsSaveState, setProductReviewsSaveState] = useState<SaveState>('idle')

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
        const footer = payload.data?.footer ?? defaultFooterSettings
        const pageReviews = payload.data?.page_reviews ?? defaultPageReviewsSettings
        const productReviews = payload.data?.product_reviews ?? defaultProductReviewsSettings

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

        setFooterSettings({
          enabled: footer.enabled ?? defaultFooterSettings.enabled,
          about_text: footer.about_text ?? defaultFooterSettings.about_text,
          contact: {
            whatsapp: footer.contact?.whatsapp ?? defaultFooterSettings.contact.whatsapp,
            email: footer.contact?.email ?? defaultFooterSettings.contact.email,
            address: footer.contact?.address ?? defaultFooterSettings.contact.address,
          },
          social: {
            instagram: footer.social?.instagram ?? defaultFooterSettings.social.instagram,
            facebook: footer.social?.facebook ?? defaultFooterSettings.social.facebook,
            tiktok: footer.social?.tiktok ?? defaultFooterSettings.social.tiktok,
          },
          links: {
            shipping_policy: footer.links?.shipping_policy ?? defaultFooterSettings.links.shipping_policy,
            return_refund: footer.links?.return_refund ?? defaultFooterSettings.links.return_refund,
            privacy: footer.links?.privacy ?? defaultFooterSettings.links.privacy,
            terms: footer.links?.terms ?? defaultFooterSettings.links.terms,
          },
        })

        setPageReviewsSettings({
          enabled: pageReviews.enabled ?? defaultPageReviewsSettings.enabled,
        })

        setProductReviewsSettings({
          enabled: productReviews.enabled ?? defaultProductReviewsSettings.enabled,
          review_window_days:
            productReviews.review_window_days ?? defaultProductReviewsSettings.review_window_days,
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

  const handleFooterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setFooterSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/footer', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: footerSettings.enabled,
          about_text: footerSettings.about_text,
          contact: {
            whatsapp: footerSettings.contact.whatsapp,
            email: footerSettings.contact.email,
            address: footerSettings.contact.address,
          },
          social: {
            instagram: footerSettings.social.instagram,
            facebook: footerSettings.social.facebook,
            tiktok: footerSettings.social.tiktok,
          },
          links: {
            shipping_policy: footerSettings.links.shipping_policy,
            return_refund: footerSettings.links.return_refund,
            privacy: footerSettings.links.privacy,
            terms: footerSettings.links.terms,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save footer settings')
      }

      setFooterSaveState('saved')
    } catch (err) {
      console.error(err)
      setFooterSaveState('error')
      setError('Unable to save footer settings.')
    } finally {
      setTimeout(() => setFooterSaveState('idle'), 2000)
    }
  }

  const handlePageReviewsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setPageReviewsSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/page_reviews', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: pageReviewsSettings.enabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save page reviews settings')
      }

      setPageReviewsSaveState('saved')
    } catch (err) {
      console.error(err)
      setPageReviewsSaveState('error')
      setError('Unable to save page reviews settings.')
    } finally {
      setTimeout(() => setPageReviewsSaveState('idle'), 2000)
    }
  }

  const handleProductReviewsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setProductReviewsSaveState('saving')
    setError(null)

    try {
      const response = await fetch('/api/ecommerce/shop-settings/product_reviews', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: productReviewsSettings.enabled,
          review_window_days: Number(productReviewsSettings.review_window_days) || 0,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save product reviews settings')
      }

      setProductReviewsSaveState('saved')
    } catch (err) {
      console.error(err)
      setProductReviewsSaveState('error')
      setError('Unable to save product reviews settings.')
    } finally {
      setTimeout(() => setProductReviewsSaveState('idle'), 2000)
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
            <label className="relative inline-flex cursor-pointer items-center isolate">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={contactSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setContactSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 isolate">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px] z-10" />
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
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Footer Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Manage the footer content shown on your storefront, including about text, social links.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleFooterSubmit}>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable Footer</p>
              <p className="text-xs text-slate-500">Toggle to show or hide the footer section.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center isolate">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={footerSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setFooterSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 isolate">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px] z-10" />
              </div>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-sm font-medium text-slate-800">About Text</span>
            <textarea
              value={footerSettings.about_text}
              disabled={!canEdit}
              onChange={(event) =>
                setFooterSettings((prev) => ({ ...prev, about_text: event.target.value }))
              }
              rows={3}
              placeholder="Share a short description about your store."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {/* <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Contact Details</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">WhatsApp</span>
                <input
                  type="text"
                  value={footerSettings.contact.whatsapp}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, whatsapp: event.target.value },
                    }))
                  }
                  placeholder="+60123456789"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Email</span>
                <input
                  type="email"
                  value={footerSettings.contact.email}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, email: event.target.value },
                    }))
                  }
                  placeholder="support@example.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-medium text-slate-800">Address</span>
                <input
                  type="text"
                  value={footerSettings.contact.address}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, address: event.target.value },
                    }))
                  }
                  placeholder="123 Example Street, Kuala Lumpur"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div> */}

          <div className="space-y-4 mt-4">
            <h4 className="text-sm font-semibold text-slate-900">Social Links</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Instagram</span>
                <input
                  type="text"
                  value={footerSettings.social.instagram}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      social: { ...prev.social, instagram: event.target.value },
                    }))
                  }
                  placeholder="@yourstore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Facebook</span>
                <input
                  type="text"
                  value={footerSettings.social.facebook}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      social: { ...prev.social, facebook: event.target.value },
                    }))
                  }
                  placeholder="facebook.com/yourstore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">TikTok</span>
                <input
                  type="text"
                  value={footerSettings.social.tiktok}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      social: { ...prev.social, tiktok: event.target.value },
                    }))
                  }
                  placeholder="@yourstore"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>

          {/* <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Footer Links</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Shipping Policy</span>
                <input
                  type="text"
                  value={footerSettings.links.shipping_policy}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      links: { ...prev.links, shipping_policy: event.target.value },
                    }))
                  }
                  placeholder="/shipping-policy"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Return & Refund</span>
                <input
                  type="text"
                  value={footerSettings.links.return_refund}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      links: { ...prev.links, return_refund: event.target.value },
                    }))
                  }
                  placeholder="/return-refund"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Privacy Policy</span>
                <input
                  type="text"
                  value={footerSettings.links.privacy}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      links: { ...prev.links, privacy: event.target.value },
                    }))
                  }
                  placeholder="/privacy-policy"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">Terms & Conditions</span>
                <input
                  type="text"
                  value={footerSettings.links.terms}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setFooterSettings((prev) => ({
                      ...prev,
                      links: { ...prev.links, terms: event.target.value },
                    }))
                  }
                  placeholder="/terms"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div> */}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || footerSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(footerSaveState)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Page Reviews Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Toggle reviews visibility on the dedicated reviews page.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handlePageReviewsSubmit}>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable Page Reviews</p>
              <p className="text-xs text-slate-500">Show reviews on your storefront reviews page.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center isolate">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={pageReviewsSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setPageReviewsSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 isolate">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px] z-10" />
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || pageReviewsSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(pageReviewsSaveState)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Product Reviews Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Control product review availability and the review submission window after purchase.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleProductReviewsSubmit}>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable Product Reviews</p>
              <p className="text-xs text-slate-500">Allow customers to leave reviews on product pages.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center isolate">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={productReviewsSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setProductReviewsSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 isolate">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px] z-10" />
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">Review Window (Days)</span>
              <input
                type="number"
                min={0}
                value={productReviewsSettings.review_window_days}
                disabled={!canEdit}
                onChange={(event) =>
                  setProductReviewsSettings((prev) => ({
                    ...prev,
                    review_window_days: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canEdit || productReviewsSaveState === 'saving'}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {renderSaveLabel(productReviewsSaveState)}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
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
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">Shipping Settings</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Configure your shipping options and fees displayed to shoppers during checkout.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleShippingSubmit}>
          {/* <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Enable Shipping</p>
              <p className="text-xs text-slate-500">Toggle to enable flat-rate shipping on your shop.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center isolate">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={shippingSettings.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, enabled: event.target.checked }))
                }
                onClick={(e) => e.stopPropagation()}
              />
              <div className="peer relative h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 isolate">
                <span className="absolute left-[2px] top-[2px] block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px] z-10" />
              </div>
            </label>
          </div> */}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">
                Flat Fee
              </span>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  RM
                </span>

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={shippingSettings.flat_fee}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setShippingSettings((prev) => ({
                      ...prev,
                      flat_fee: Number(event.target.value),
                    }))
                  }
                  placeholder="0.00"
                  className={`
                    w-full rounded-lg border px-3 py-2 pl-10 text-sm shadow-sm outline-none
                    ${canEdit
                      ? "border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      : "border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed"}
                  `}
                />
              </div>
            </label>


            {/* <label className="space-y-2">
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
            </label> */}

            {/* <label className="space-y-2 md:col-span-2">
              <span className="block text-sm font-medium text-slate-800">Label (Optional)</span>
              <input
                type="text"
                value={shippingSettings.label}
                disabled={!canEdit}
                onChange={(event) =>
                  setShippingSettings((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="e.g. Shipping fees"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label> */}
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
