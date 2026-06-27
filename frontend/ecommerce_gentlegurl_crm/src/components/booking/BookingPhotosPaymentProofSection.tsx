'use client'

import { useMemo } from 'react'

import BookingServicePhotosModal from '@/components/booking/BookingServicePhotosModal'
import { type BookingServicePhoto } from '@/components/booking/BookingServicePhotosPanel'
import CustomerUploadedPhotosModal from '@/components/booking/CustomerUploadedPhotosModal'
import PaymentProofModal from '@/components/payment/PaymentProofModal'
import { type PaymentProof } from '@/components/payment/PaymentProofPreview'

type CustomerReferencePhoto = {
  id: number
  file_url?: string | null
  original_name?: string | null
}

type BookingPhotosPaymentProofSectionProps = {
  bookingId: number
  bookingCode: string
  customerReferencePhotos?: CustomerReferencePhoto[] | null
  servicePhotos?: BookingServicePhoto[] | null
  paymentProofs?: PaymentProof[] | null
  onServicePhotosChanged?: (photos: BookingServicePhoto[]) => void
  canManageServicePhotos?: boolean
  className?: string
}

export default function BookingPhotosPaymentProofSection({
  bookingId,
  bookingCode,
  customerReferencePhotos,
  servicePhotos,
  paymentProofs,
  onServicePhotosChanged,
  canManageServicePhotos = true,
  className,
}: BookingPhotosPaymentProofSectionProps) {
  const galleryPhotos = useMemo(
    () =>
      (customerReferencePhotos ?? []).map((photo) => ({
        id: photo.id,
        resolved_url: photo.file_url ?? '',
        created_at: null,
      })),
    [customerReferencePhotos],
  )

  return (
    <section className={className ?? 'rounded-xl border border-slate-200 bg-white p-4'}>
      <h4 className="mb-3 text-sm font-bold text-slate-900">Photos & payment proof</h4>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CustomerUploadedPhotosModal
          photos={galleryPhotos}
          bookingCode={bookingCode}
          layout="tile"
          buttonLabel="Customer reference photos"
          modalTitle="Customer reference photos"
          modalDescription="Reference photos submitted by the customer for this booking."
          gallerySectionTitle="Reference photos"
          emptyTitle="No reference photos"
          emptyDescription="The customer has not uploaded any reference photos for this booking."
        />
        <BookingServicePhotosModal
          bookingId={bookingId}
          bookingCode={bookingCode}
          initialPhotos={servicePhotos ?? []}
          layout="tile"
          buttonLabel="Salon service photos"
          canManage={canManageServicePhotos}
          onChanged={onServicePhotosChanged}
        />
        <PaymentProofModal proofs={paymentProofs} bookingCode={bookingCode} layout="tile" />
      </div>
    </section>
  )
}
