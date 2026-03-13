"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { BookingSummary } from "@/components/booking/BookingSummary";
import { DateSelector } from "@/components/booking/DateSelector";
import { ServiceSelector } from "@/components/booking/ServiceSelector";
import { StaffSelector } from "@/components/booking/StaffSelector";
import { TimeSlotSelector } from "@/components/booking/TimeSlotSelector";
import { addCartItem, getAvailability, getBookingServiceDetail, getBookingServices } from "@/lib/apiClient";
import { BookingSlot, Service, Staff } from "@/lib/types";

type AvailabilityPayload = {
  success?: boolean;
  message?: string;
  data?: {
    slots?: BookingSlot[];
  };
};

const timezone = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

function getDateTabs(days = 10) {
  const formatterDay = new Intl.DateTimeFormat("en-MY", { weekday: "short", timeZone: timezone });
  const formatterDayNumber = new Intl.DateTimeFormat("en-MY", { day: "2-digit", timeZone: timezone });
  const formatterMonth = new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: timezone });

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return {
      value: date.toISOString().slice(0, 10),
      dayName: formatterDay.format(date),
      dayNumber: formatterDayNumber.format(date),
      monthName: formatterMonth.format(date),
    };
  });
}

export default function BookingPage() {
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<BookingSlot[]>([]);

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(getDateTabs(1)[0].value);
  const [selectedSlotStartAt, setSelectedSlotStartAt] = useState<string | null>(null);

  const [servicesLoading, setServicesLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [servicesError, setServicesError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dateTabs = useMemo(() => getDateTabs(), []);
  const selectedService = services.find((service) => service.id === selectedServiceId) || null;
  const selectedStaff = staffs.find((staff) => staff.id === selectedStaffId) || null;

  useEffect(() => {
    const run = async () => {
      setServicesLoading(true);
      setServicesError(null);

      try {
        const list = await getBookingServices();
        setServices(list);
        if (list[0]) {
          setSelectedServiceId(list[0].id);
        }
      } catch (error) {
        setServicesError(error instanceof Error ? error.message : "Unable to load services.");
      } finally {
        setServicesLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setStaffs([]);
      return;
    }

    const run = async () => {
      setStaffLoading(true);
      setStaffError(null);
      setSlots([]);
      setSelectedStaffId(null);
      setSelectedSlotStartAt(null);

      try {
        const detail = await getBookingServiceDetail(String(selectedServiceId));
        const availableStaff = detail.staffs || [];
        setStaffs(availableStaff);

        if (availableStaff[0]) {
          setSelectedStaffId(availableStaff[0].id);
        }
      } catch (error) {
        setStaffError(error instanceof Error ? error.message : "Unable to load staff.");
      } finally {
        setStaffLoading(false);
      }
    };

    run();
  }, [selectedServiceId]);

  const loadSlots = useCallback(async () => {
    if (!selectedServiceId || !selectedStaffId || !selectedDate) {
      return;
    }

    setSlotLoading(true);
    setSlotError(null);
    setSelectedSlotStartAt(null);

    try {
      const result = await getAvailability(String(selectedServiceId), String(selectedStaffId), selectedDate);
      const payload = (result.data ?? result) as AvailabilityPayload["data"];
      const availableSlots = Array.isArray(payload?.slots) ? payload.slots : [];

      if (result.success === false) {
        setSlots([]);
        setSlotError(result.message || "Unable to load slot availability.");
        return;
      }

      setSlots(availableSlots);
    } catch (error) {
      setSlots([]);
      setSlotError(error instanceof Error ? error.message : "Unable to load slot availability.");
    } finally {
      setSlotLoading(false);
    }
  }, [selectedDate, selectedServiceId, selectedStaffId]);

  useEffect(() => {
    if (selectedServiceId && selectedStaffId && selectedDate) {
      loadSlots();
    }
  }, [loadSlots, selectedDate, selectedServiceId, selectedStaffId]);

  const handleConfirmBooking = async () => {
    if (!selectedServiceId || !selectedStaffId || !selectedSlotStartAt) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await addCartItem({
        service_id: selectedServiceId,
        staff_id: selectedStaffId,
        start_at: selectedSlotStartAt,
      });

      router.push("/booking/cart");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add selected slot to cart.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f3ee] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <BookingHeader
          title="Book Your Glow Session"
          subtitle="Select your service, preferred staff, date, and slot. Your booking will be reserved after you confirm and continue to cart checkout."
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <ServiceSelector
              services={services}
              selectedServiceId={selectedServiceId}
              loading={servicesLoading}
              error={servicesError}
              onSelectService={setSelectedServiceId}
            />

            <StaffSelector
              staffs={staffs}
              selectedStaffId={selectedStaffId}
              loading={staffLoading}
              error={staffError}
              disabled={!selectedServiceId}
              onSelectStaff={setSelectedStaffId}
            />

            <DateSelector
              dates={dateTabs}
              selectedDate={selectedDate}
              disabled={!selectedStaffId}
              onSelectDate={setSelectedDate}
            />

            <TimeSlotSelector
              slots={slots}
              selectedSlotStartAt={selectedSlotStartAt}
              loading={slotLoading}
              error={slotError}
              disabled={!selectedServiceId || !selectedStaffId || !selectedDate}
              onRefreshSlots={loadSlots}
              onSelectSlot={setSelectedSlotStartAt}
            />
          </div>

          <BookingSummary
            service={selectedService}
            staff={selectedStaff}
            date={selectedDate}
            slotStartAt={selectedSlotStartAt}
            submitting={submitting}
            submitError={submitError}
            onConfirmBooking={handleConfirmBooking}
          />
        </div>
      </div>
    </main>
  );
}
