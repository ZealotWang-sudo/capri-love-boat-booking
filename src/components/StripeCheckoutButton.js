"use client";

import { useEffect, useState } from "react";

export default function StripeCheckoutButton({ bookingId, labels, token }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function resetPendingState() {
      setPending(false);
    }

    window.addEventListener("pageshow", resetPendingState);
    document.addEventListener("visibilitychange", resetPendingState);

    return () => {
      window.removeEventListener("pageshow", resetPendingState);
      document.removeEventListener("visibilitychange", resetPendingState);
    };
  }, []);

  async function handleClick() {
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          booking_id: bookingId,
          token,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || labels.error);
      }

      window.location.href = result.checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError.message || labels.error);
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="mt-5 w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        {pending ? labels.pending : labels.default}
      </button>
      {error ? (
        <p className="mt-3 text-sm leading-6 text-red-900">{error}</p>
      ) : null}
    </div>
  );
}
