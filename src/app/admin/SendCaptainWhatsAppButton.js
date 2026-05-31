"use client";

import { useState } from "react";
import AdminNotice from "./AdminNotice";
import { sendCaptainWhatsappBookingAction } from "./actions";

export default function SendCaptainWhatsAppButton({
  booking,
  messageType,
}) {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const isSending = status === "sending";

  async function handleSend() {
    try {
      setStatus("sending");
      setErrorMessage("");
      setWarningMessage("");
      const payload = {
        booking_id: booking.id,
        message_type: messageType || "",
        to_phone: null,
      };
      const response = await fetch("/api/whatsapp/send-captain-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let parsedResponse = null;

      try {
        parsedResponse = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsedResponse = null;
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseText.slice(0, 300) || "Empty response"}`,
        );
      }

      if (parsedResponse?.error) {
        throw new Error(String(parsedResponse.error).slice(0, 300));
      }

      await sendCaptainWhatsappBookingAction({
        bookingId: booking.id,
        messageType,
      });

      if (parsedResponse?.tracking?.inserted === false) {
        setStatus("sent");
        setWarningMessage(
          `WhatsApp sent, but tracking row was not saved: ${String(parsedResponse?.tracking?.error || "Unknown error.").slice(0, 220)}`,
        );
        return;
      }

      setStatus("sent");
    } catch (error) {
      setStatus("failed");
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Could not send WhatsApp to captain.",
      );
    }
  }

  return (
    <>
      {status === "sent" ? (
        <AdminNotice>WhatsApp availability request sent to captain.</AdminNotice>
      ) : null}
      {status === "failed" ? (
        <AdminNotice tone="error">{errorMessage}</AdminNotice>
      ) : null}
      {warningMessage ? (
        <AdminNotice tone="error">{warningMessage}</AdminNotice>
      ) : null}
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending}
        aria-busy={isSending}
        className="border border-stone-950 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone-950 transition hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        {isSending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
            />
            Sending...
          </span>
        ) : status === "sent" ? (
          "Sent"
        ) : (
          "Send WhatsApp to Captain"
        )}
      </button>
    </>
  );
}
