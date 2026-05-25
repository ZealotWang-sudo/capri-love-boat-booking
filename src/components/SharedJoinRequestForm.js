"use client";

import { useRef, useState } from "react";
import FormDropdown from "@/components/FormDropdown";
import PhoneInput from "@/components/PhoneInput";
import PolicyContent from "@/components/PolicyContent";

function Field({ children, label }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "€-";
}

export default function SharedJoinRequestForm({
  genderOptions,
  labels,
  locale,
  maxGuests,
  sharedRequestFeeEur,
  token,
}) {
  const [customerName, setCustomerName] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [genderComposition, setGenderComposition] = useState(
    genderOptions[0]?.value ?? "prefer_not_to_say",
  );
  const [guestCount, setGuestCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferredContactMethod, setPreferredContactMethod] = useState("whatsapp");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoStatus, setPromoStatus] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [wechat, setWechat] = useState("");
  const formRef = useRef(null);
  const guestOptions = Array.from({ length: maxGuests }, (_, index) => ({
    label: String(index + 1),
    value: index + 1,
  }));
  const finalAuthorizationFeeEur =
    appliedPromo?.finalReservationFeeEur ?? sharedRequestFeeEur;
  const emailMatches =
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase();
  const isFormComplete =
    customerName.trim() &&
    email.trim() &&
    confirmEmail.trim() &&
    emailMatches &&
    (preferredContactMethod !== "wechat" || wechat.trim());

  function clearAppliedPromo() {
    setAppliedPromo(null);
    setPromoError("");
    setPromoStatus("");
  }

  async function handleApplyPromoCode() {
    const code = promoCodeInput.trim();

    if (!code) {
      return;
    }

    setPromoLoading(true);
    setPromoError("");
    setPromoStatus("");

    try {
      const response = await fetch("/api/promo-codes/validate", {
        body: JSON.stringify({
          code,
          original_reservation_fee_eur: sharedRequestFeeEur,
          pricing_context: "shared_join_request",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setAppliedPromo(null);
        setPromoError(data?.error || labels.promoInvalid);
        return;
      }

      setAppliedPromo({
        code: data.code,
        finalReservationFeeEur: data.finalReservationFeeEur,
        promoDiscountEur: data.promoDiscountEur,
      });
      setPromoCodeInput(data.code);
      setPromoStatus(labels.promoApplied);
    } catch {
      setAppliedPromo(null);
      setPromoError(labels.promoInvalid);
    } finally {
      setPromoLoading(false);
    }
  }

  async function submitJoinRequest() {
    setErrorMessage("");
    setIsSubmitting(true);
    setConfirmModalOpen(false);

    const formData = new FormData(formRef.current);
    const payload = {
      consent_accepted: true,
      confirm_email: formData.get("confirm_email"),
      customer_name: formData.get("customer_name"),
      email: formData.get("email"),
      gender_composition: genderComposition,
      guest_count: Number(guestCount),
      locale,
      message: formData.get("message"),
      promo_code: appliedPromo?.code,
      phone: formData.get("phone"),
      preferred_contact_method: preferredContactMethod,
      token,
      whatsapp: formData.get("whatsapp"),
      wechat: formData.get("wechat"),
    };

    try {
      const response = await fetch("/api/shared-join-requests", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.checkoutUrl) {
        setErrorMessage(
          labels.errors[data.errorKey] || data.error || labels.errors.generic,
        );
        return;
      }

      window.location.assign(data.checkoutUrl);
    } catch {
      setErrorMessage(labels.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    if (!isFormComplete) {
      setErrorMessage(
        email.trim() && confirmEmail.trim() && !emailMatches
          ? labels.emailMismatch
          : labels.errors.missingRequired,
      );
      return;
    }

    setConfirmModalOpen(true);
  }

  return (
    <section className="mt-8 border border-stone-300 bg-[#f3eee7] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
        {labels.title}
      </p>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        {labels.intro}
      </p>

      {errorMessage ? (
        <div className="mt-5 border border-red-900/40 bg-[#fbf8f3] p-4 text-sm leading-6 text-red-900">
          {errorMessage}
        </div>
      ) : null}

      <form ref={formRef} className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={labels.customerName}>
            <input
              name="customer_name"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="mt-2 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
            />
          </Field>
          <Field label={labels.email}>
            <input
              name="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
            />
          </Field>
          <Field label={labels.confirmEmail}>
            <input
              name="confirm_email"
              required
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              className="mt-2 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
            />
            {confirmEmail.trim() && !emailMatches ? (
              <p className="mt-2 text-sm text-red-900">{labels.emailMismatch}</p>
            ) : null}
          </Field>
          <PhoneInput
            countryCodeLabel={labels.phoneCountryCode}
            label={labels.phone}
            locale={locale}
          />
          <FormDropdown
            name="preferred_contact_method"
            label={labels.preferredContactMethod}
            value={preferredContactMethod}
            onChange={setPreferredContactMethod}
            options={labels.contactOptions}
          />
          {preferredContactMethod === "wechat" ? (
            <Field label={labels.contactWechat}>
              <input
                name="wechat"
                required
                value={wechat}
                onChange={(event) => setWechat(event.target.value)}
                className="mt-2 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
              />
            </Field>
          ) : null}
          <FormDropdown
            name="guest_count"
            label={labels.guestCount}
            value={guestCount}
            onChange={(nextValue) => setGuestCount(Number(nextValue))}
            options={guestOptions}
          />
          <FormDropdown
            name="gender_composition"
            label={labels.genderComposition}
            value={genderComposition}
            onChange={setGenderComposition}
            options={genderOptions}
          />
        </div>

        <Field label={labels.message}>
          <textarea
            name="message"
            className="mt-2 min-h-28 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-950"
          />
        </Field>

        <div className="border border-stone-300 bg-[#fbf8f3] p-4 text-sm leading-6 text-stone-600">
          <p className="font-medium text-stone-950">
            {labels.authorizationAmount}: {formatEuro(finalAuthorizationFeeEur)}
          </p>
          {appliedPromo?.promoDiscountEur ? (
            <p className="mt-1 text-emerald-800">
              {labels.promoDiscount}: -{formatEuro(appliedPromo.promoDiscountEur)}
            </p>
          ) : null}
          <p className="mt-3">{labels.preAuthorization}</p>
          <p className="mt-3">{labels.costSplitNote}</p>
          <div className="mt-4 border-t border-stone-300 pt-4">
            <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
              {labels.promoCode}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={promoCodeInput}
                onChange={(event) => {
                  setPromoCodeInput(event.target.value);
                  clearAppliedPromo();
                }}
                placeholder={labels.promoCodePlaceholder}
                className="min-w-0 flex-1 border border-stone-300 bg-transparent px-3 py-2 text-sm uppercase outline-none transition focus:border-stone-950"
              />
              <button
                type="button"
                onClick={handleApplyPromoCode}
                disabled={!promoCodeInput.trim() || promoLoading}
                className="border border-stone-950 bg-stone-950 px-4 py-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {promoLoading ? labels.promoApplying : labels.promoApply}
              </button>
            </div>
            {promoStatus ? (
              <p className="mt-2 text-sm text-emerald-800">{promoStatus}</p>
            ) : null}
            {promoError ? (
              <p className="mt-2 text-sm text-red-900">{promoError}</p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? labels.submittingButton : labels.submitButton}
        </button>
      </form>
      {confirmModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-stone-950/45 px-5 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shared-join-confirm-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden border border-stone-950 bg-[#fbf8f3] shadow-xl">
            <div className="shrink-0 border-b border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="shared-join-confirm-title"
                    className="text-2xl font-light tracking-[-0.03em]"
                  >
                    {labels.confirmModalTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {labels.confirmModalIntro}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
                >
                  {labels.confirmModalClose}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
              <section className="border border-stone-300 bg-[#f3eee7] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {labels.disclaimerTitle}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {labels.disclaimer}
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {labels.consent}
                </p>
              </section>
              <PolicyContent labels={labels.policy} variant="modal" />
            </div>

            <div className="shrink-0 border-t border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitJoinRequest}
                className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60 disabled:hover:bg-stone-950 disabled:hover:text-[#f3eee7]"
              >
                {isSubmitting ? labels.submittingButton : labels.confirmModalAccept}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
