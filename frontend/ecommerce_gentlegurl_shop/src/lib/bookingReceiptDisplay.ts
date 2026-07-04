export type BookingAddonReceiptLabel = {
  name: string
  serviceContext: string | null
}

export function formatBookingAddonReceiptLabel(rawName: string): BookingAddonReceiptLabel {
  const name = String(rawName ?? '').trim()
  if (!name) {
    return { name: 'Add-on', serviceContext: null }
  }

  if (name.includes('::')) {
    const separatorIndex = name.indexOf('::')
    const serviceRef = name.slice(0, separatorIndex).trim()
    const addonName = name.slice(separatorIndex + 2).trim() || name

    return {
      name: addonName,
      serviceContext: serviceRef && serviceRef.toLowerCase() !== 'original' ? serviceRef : null,
    }
  }

  for (const prefix of ['Final Settlement - ', 'Booking Deposit - ', 'Add-on - ']) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
      return { name: name.slice(prefix.length).trim() || name, serviceContext: null }
    }
  }

  return { name, serviceContext: null }
}

export function resolveBookingReceiptItemLabel(item: {
  type?: string | null
  name: string
  addon_service_context?: string | null
}): BookingAddonReceiptLabel {
  if (String(item.type ?? '') === 'booking_addon') {
    const formatted = formatBookingAddonReceiptLabel(item.name)
    const context = item.addon_service_context?.trim() || formatted.serviceContext

    return {
      name: formatted.name,
      serviceContext: context || null,
    }
  }

  return { name: item.name, serviceContext: null }
}

export function shouldShowBookingReceiptItem(item: { type?: string | null; name: string }) {
  const lineType = String(item.type ?? '')
  const name = String(item.name ?? '')

  return !(name.includes('::') && lineType === 'booking_settlement')
}
