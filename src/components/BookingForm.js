"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PhoneInput from "@/components/PhoneInput";
import PolicyContent from "@/components/PolicyContent";
import StyledCheckbox from "@/components/StyledCheckbox";

const FALLBACK_ALTERNATIVE_TOUR_COPY = {
  en: {
    message:
      "Your selected tour type is fully booked at this time on this date, but another tour type is still available: {tours}.",
    switchButton: "Switch to another tour type",
  },
  zh: {
    message: "这个日期所选行程类型在当前时间段已满，但还有其他行程类型可预约：{tours}。",
    switchButton: "切换到其他行程类型",
  },
  it: {
    message:
      "Il tipo di tour selezionato e al completo per questo orario in questa data, ma un altro tipo di tour e ancora disponibile: {tours}.",
    switchButton: "Passa a un altro tipo di tour",
  },
};

export default function BookingForm({ locale, labels }) {
  const router = useRouter();
  const policyScrollRef = useRef(null);
  const [dateError, setDateError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyScrolledToEnd, setPolicyScrolledToEnd] = useState(false);
  const [tourInfoOpen, setTourInfoOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [calendarMonth, setCalendarMonth] = useState("");
  const [availability, setAvailability] = useState({
    alternativeAvailableDates: [],
    alternativeTourTypesByDate: {},
    blockedSlotsByDate: {},
    fullyBookedDates: [],
    month: "",
    partiallyBookedDates: [],
    tourType: "",
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const selectedTourOption = labels.tourOptions.find(
    (option) => option.value === selectedTour,
  );
  const availabilityTourType = selectedTour;
  const blockedTimeSlots = useMemo(() => {
    if (!selectedDate) {
      return new Set();
    }

    const isCurrentAvailability =
      availability.month === calendarMonth &&
      availability.tourType === availabilityTourType;

    return new Set(
      selectedTour && isCurrentAvailability
        ? (availability.blockedSlotsByDate[selectedDate] ?? [])
        : [],
    );
  }, [
    availabilityTourType,
    availability.blockedSlotsByDate,
    availability.month,
    availability.tourType,
    calendarMonth,
    selectedDate,
    selectedTour,
  ]);
  const fullyBookedDates =
    availability.month === calendarMonth &&
    availability.tourType === availabilityTourType
      ? availability.fullyBookedDates
      : [];
  const alternativeAvailableDates =
    availability.month === calendarMonth &&
    availability.tourType === availabilityTourType
      ? availability.alternativeAvailableDates
      : [];
  const partiallyBookedDates =
    availability.month === calendarMonth &&
    availability.tourType === availabilityTourType
      ? availability.partiallyBookedDates
      : [];
  const alternativeTourTypesForSelectedDate =
    selectedDate &&
    availability.month === calendarMonth &&
    availability.tourType === availabilityTourType
      ? (availability.alternativeTourTypesByDate[selectedDate] ?? [])
      : [];
  const alternativeTourOptionsForSelectedDate = labels.tourOptions.filter((option) =>
    alternativeTourTypesForSelectedDate.includes(option.value),
  );
  const alternativeTourLabels = alternativeTourOptionsForSelectedDate
    .map((option) => option.label)
    .join(", ");
  const fallbackAlternativeTourCopy =
    FALLBACK_ALTERNATIVE_TOUR_COPY[locale] ?? FALLBACK_ALTERNATIVE_TOUR_COPY.en;
  const otherTourAvailableMessage =
    labels.otherTourAvailableMessage?.startsWith("Booking.")
      ? fallbackAlternativeTourCopy.message
      : labels.otherTourAvailableMessage;
  const switchToTourLabel = labels.switchToTour?.startsWith("Booking.")
    ? fallbackAlternativeTourCopy.switchButton
    : labels.switchToTour;
  const allTimeSlotsBlocked =
    selectedTourOption?.timeSlots.length > 0 &&
    selectedTourOption.timeSlots.every((timeSlot) =>
      blockedTimeSlots.has(timeSlot.value),
    );
  const handleCalendarMonthChange = useCallback((month) => {
    setCalendarMonth(month);
  }, []);

  function selectTour(tourValue, { clearDate = true } = {}) {
    setSelectedTour(tourValue);
    if (clearDate) {
      setSelectedDate("");
    }
    setSelectedTime("");
    setDateError(false);
    setSubmitError("");
  }

  function handlePolicyScroll(event) {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom <= 8) {
      setPolicyScrolledToEnd(true);
    }
  }

  useEffect(() => {
    if (!selectedTour || !calendarMonth) {
      return;
    }

    const controller = new AbortController();

    async function loadAvailability() {
      setAvailabilityLoading(true);

      try {
        const params = new URLSearchParams({
          month: calendarMonth,
          tourType: availabilityTourType,
        });
        const response = await fetch(`/api/availability?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Availability request failed.");
        }

        const data = await response.json();
        const nextAvailability = {
          alternativeAvailableDates: data.alternativeAvailableDates ?? [],
          alternativeTourTypesByDate: data.alternativeTourTypesByDate ?? {},
          blockedSlotsByDate: data.blockedSlotsByDate ?? {},
          fullyBookedDates: data.fullyBookedDates ?? [],
          month: calendarMonth,
          partiallyBookedDates: data.partiallyBookedDates ?? [],
          tourType: availabilityTourType,
        };

        setAvailability(nextAvailability);

        if (
          selectedDate &&
          selectedTime &&
          nextAvailability.blockedSlotsByDate[selectedDate]?.includes(selectedTime)
        ) {
          setSelectedTime("");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Availability load failed", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    }

    loadAvailability();

    return () => {
      controller.abort();
    };
  }, [availabilityTourType, calendarMonth, selectedDate, selectedTime, selectedTour]);

  useEffect(() => {
    if (!policyModalOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const element = policyScrollRef.current;

      if (element && element.scrollHeight <= element.clientHeight + 8) {
        setPolicyScrolledToEnd(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [policyModalOpen]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!policyAccepted) {
      setSubmitError(labels.policyRequired);
      setPolicyScrolledToEnd(false);
      setPolicyModalOpen(true);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const confirmEmail = formData
      .get("confirmEmail")
      ?.toString()
      .trim()
      .toLowerCase();

    if (email !== confirmEmail) {
      setEmailError(true);
      return;
    }

    const requestedDate = formData.get("date")?.toString();

    if (!requestedDate) {
      setDateError(true);
      return;
    }

    const timeSlot = formData.get("time")?.toString();
    const selectedTimeSlot = selectedTourOption?.timeSlots.find(
      (slot) => slot.value === timeSlot,
    );
    const customerName = formData.get("name")?.toString().trim();
    const phone = formData.get("phone")?.toString().trim();
    const guestCount = Number(formData.get("guests"));
    const message = formData.get("message")?.toString().trim();

    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          customer_name: customerName,
          email,
          phone,
          contact_method: "email",
          guest_count: guestCount,
          requested_date: requestedDate,
          tour_type: selectedTourOption?.value,
          time_slot: timeSlot,
          time_window: selectedTimeSlot?.window,
          total_price_eur: selectedTourOption?.totalPriceEur,
          reservation_fee_eur: selectedTourOption?.reservationFeeEur,
          pay_on_board_eur: selectedTourOption?.payOnBoardEur,
          message,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);

        console.error("Booking submit failed", errorBody);
        setSubmitError(
          response.status === 409
            ? labels.timeNoLongerAvailable
            : labels.submitError,
        );
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      const referenceCode = data.bookingId
        ? `CAPRI-${data.bookingId.slice(0, 8).toUpperCase()}`
        : "";

      window.sessionStorage.setItem(
        "bookingRequestSummary",
        JSON.stringify({
          referenceCode,
          customerName,
          email,
          phone,
          guestCount,
          requestedDate,
          tourLabel: selectedTourOption?.label,
          timeLabel: selectedTimeSlot?.label,
          totalPrice: selectedTourOption?.price,
          reserveToday: selectedTourOption?.reserveToday,
          payOnBoard: selectedTourOption?.payOnBoard,
          message,
        }),
      );
      router.push(`/${locale}/thank-you`);
    } catch {
      setSubmitError(labels.submitError);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.name}
        </label>
        <input
          name="name"
          required
          className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.email}
          </label>
          <input
            name="email"
            type="email"
            required
            onChange={() => setEmailError(false)}
            aria-invalid={emailError}
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.confirmEmail}
          </label>
          <input
            name="confirmEmail"
            type="email"
            required
            onChange={() => setEmailError(false)}
            aria-invalid={emailError}
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
          {emailError ? (
            <p className="mt-3 text-sm leading-6 text-red-900">
              {labels.emailMismatch}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <PhoneInput
          countryCodeLabel={labels.phoneCountryCode}
          label={labels.phone}
          locale={locale}
        />
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.guests}
          </label>
          <input
            name="guests"
            type="number"
            min="1"
            max="6"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
      </div>

      <section className="border-t border-stone-300 pt-6">
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.stepChooseTour}
        </label>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            {labels.tourPlaceholder}
          </p>
          <button
            type="button"
            onClick={() => setTourInfoOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-stone-300 text-xs uppercase text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
            aria-label={labels.tourInfoButton}
            aria-expanded={tourInfoOpen}
            aria-haspopup="dialog"
          >
            ?
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {labels.tourOptions.map((option) => (
            <StyledCheckbox
              key={option.value}
              type="radio"
              name="tourType"
              value={option.value}
              label={option.label}
              required
              checked={selectedTour === option.value}
              onChange={() => {
                selectTour(option.value);
              }}
            />
          ))}
        </div>
        {tourInfoOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-5 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-info-title"
          >
            <div className="w-full max-w-lg border border-stone-950 bg-[#fbf8f3] p-6 shadow-xl sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-5">
                <h2
                  id="tour-info-title"
                  className="text-2xl font-light tracking-[-0.03em]"
                >
                  {labels.tourInfoTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setTourInfoOpen(false)}
                  className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
                >
                  {labels.tourInfoClose}
                </button>
              </div>
              <div className="mt-6 space-y-5">
                {labels.tourOptions.map((option) => (
                  <article
                    key={option.value}
                    className="border-l border-stone-950 pl-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-normal">{option.label}</h3>
                      <p className="shrink-0 text-xs uppercase tracking-[0.18em] text-stone-500">
                        {option.price}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {selectedTour ? (
        <section className="border-t border-stone-300 pt-6">
          <AvailabilityCalendar
            key={selectedTour}
            alternativeAvailableDates={alternativeAvailableDates}
            fullyBookedDates={fullyBookedDates}
            label={labels.stepChooseDate}
            labels={labels.calendar}
            error={dateError}
            onMonthChange={handleCalendarMonthChange}
            onSelect={(date) => {
              setDateError(false);
              setSelectedDate(date);
              setSelectedTime("");
            }}
            partiallyBookedDates={partiallyBookedDates}
            value={selectedDate}
          />
        </section>
      ) : null}

      <section className="border-t border-stone-300 pt-6">
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.stepChooseTime}
        </label>
        {selectedTourOption ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {selectedTourOption.timeSlots.map((timeSlot) => {
              const blocked = blockedTimeSlots.has(timeSlot.value);

              return (
                <StyledCheckbox
                  key={timeSlot.value}
                  type="radio"
                  name="time"
                  value={timeSlot.value}
                  label={
                    blocked
                      ? `${timeSlot.label} · ${labels.timeUnavailable}`
                      : timeSlot.label
                  }
                  checked={selectedTime === timeSlot.value}
                  disabled={blocked}
                  required
                  onChange={() => setSelectedTime(timeSlot.value)}
                />
              );
            })}
          </div>
        ) : (
          <p className="mt-3 border border-stone-300 px-4 py-4 text-sm leading-6 text-stone-500">
            {labels.timePlaceholder}
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {availabilityLoading
            ? labels.availabilityLoading
            : labels.timeConfirmationNote}
        </p>
        {selectedTourOption && selectedDate && allTimeSlotsBlocked ? (
          <div
            className={`mt-3 border p-4 text-sm leading-6 ${
              alternativeTourOptionsForSelectedDate.length > 0
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <p>
              {alternativeTourOptionsForSelectedDate.length > 0
                ? otherTourAvailableMessage.replace("{tours}", alternativeTourLabels)
                : labels.allTimeSlotsBooked}
            </p>
            {alternativeTourOptionsForSelectedDate.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  selectTour(alternativeTourOptionsForSelectedDate[0].value, {
                    clearDate: false,
                  })
                }
                className="mt-3 border border-amber-700 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-amber-950 transition hover:bg-amber-700 hover:text-white"
              >
                {switchToTourLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="border-t border-stone-300 pt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.stepPrice}
        </p>
        {selectedTourOption ? (
          <div className="mt-3 border border-stone-300 bg-[#f3eee7]/40 p-4">
            <div className="flex items-center justify-between gap-4 border-b border-stone-300 pb-3">
              <span className="text-sm leading-6 text-stone-600">
                {labels.totalPrice}
              </span>
              <span className="text-xl font-light">
                {selectedTourOption.price}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-sm leading-6 text-stone-600">
              <span>{labels.reserveToday}</span>
              <span>{selectedTourOption.reserveToday}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-sm leading-6 text-stone-600">
              <span>{labels.payOnBoard}</span>
              <span>{selectedTourOption.payOnBoard}</span>
            </div>
          </div>
        ) : (
          <p className="mt-3 border border-stone-300 px-4 py-4 text-sm leading-6 text-stone-500">
            {labels.pricePlaceholder}
          </p>
        )}
      </section>

      <div>
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.message}
        </label>
        <textarea
          name="message"
          className="mt-3 min-h-32 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-stone-950 disabled:hover:text-[#f3eee7]"
      >
        {isSubmitting ? labels.submitting : labels.submit}
      </button>
      {submitError ? (
        <p className="text-sm leading-6 text-red-900">{submitError}</p>
      ) : null}
      {policyModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-stone-950/45 px-5 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden border border-stone-950 bg-[#fbf8f3] shadow-xl">
            <div className="shrink-0 border-b border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="policy-modal-title"
                  className="text-2xl font-light tracking-[-0.03em]"
                >
                  {labels.policyModalTitle}
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {labels.policyModalIntro}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPolicyScrolledToEnd(false);
                  setPolicyModalOpen(false);
                }}
                className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
              >
                {labels.policyModalClose}
              </button>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8"
              onScroll={handlePolicyScroll}
              ref={policyScrollRef}
            >
              <PolicyContent labels={labels.policy} variant="modal" />
            </div>

            <div className="shrink-0 border-t border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
              <button
                type="button"
                disabled={!policyScrolledToEnd}
                onClick={() => {
                  setPolicyAccepted(true);
                  setPolicyModalOpen(false);
                  setSubmitError("");
                }}
                className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone-950 disabled:hover:text-[#f3eee7]"
              >
                {labels.policyModalAccept}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
