import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sendCaptainBookingRequest } from "@/lib/notifications/captainBookingRequest";
import { createBookingRequest } from "./helpers/bookingFixtures.mjs";
import { createFakeSupabase } from "./helpers/fakeSupabase.mjs";

function setup({ bookingOverrides = {} } = {}) {
  const booking = createBookingRequest({
    booking_status: "checking_with_captain",
    captain_status: "pending",
    payment_status: "authorized",
    ...bookingOverrides,
  });
  const supabase = createFakeSupabase({
    bookings: [booking],
    whatsapp_messages: [],
  });

  return { booking, supabase };
}

describe("sendCaptainBookingRequest", () => {
  it("sends the availability request and records it", async () => {
    const { booking, supabase } = setup();
    const sent = [];

    const result = await sendCaptainBookingRequest({
      booking,
      sendTelegram: async (payload) => {
        sent.push(payload);
        return { ok: true, result: { message_id: 4321 } };
      },
      supabase,
    });

    assert.equal(result.sent, true);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /CAPRI-433C4C03/);
    assert.deepEqual(
      sent[0].replyMarkup.inline_keyboard[0].map((button) => button.callback_data),
      [`booking:accept:${booking.id}`, `booking:decline:${booking.id}`],
    );
    assert.equal(supabase.rows("bookings")[0].captain_status, "message_sent");
    assert.equal(supabase.rows("whatsapp_messages").length, 1);
  });

  it("sends only once when several callers race", async () => {
    const { booking, supabase } = setup();
    let sendCount = 0;
    const sendTelegram = async () => {
      sendCount += 1;
      return { ok: true, result: { message_id: sendCount } };
    };

    const results = await Promise.all([
      sendCaptainBookingRequest({ booking, sendTelegram, supabase }),
      sendCaptainBookingRequest({ booking, sendTelegram, supabase }),
      sendCaptainBookingRequest({ booking, sendTelegram, supabase }),
    ]);

    assert.equal(sendCount, 1);
    assert.equal(results.filter((result) => result.sent).length, 1);
  });

  it("re-opens the claim when Telegram fails so it can be retried", async () => {
    const { booking, supabase } = setup();

    const failed = await sendCaptainBookingRequest({
      booking,
      sendTelegram: async () => {
        throw new Error("Telegram is unavailable");
      },
      supabase,
    });

    assert.equal(failed.sent, false);
    assert.equal(
      supabase.rows("bookings")[0].captain_status,
      "pending",
      "reconciliation looks for captain_status = pending",
    );

    const retried = await sendCaptainBookingRequest({
      booking: supabase.rows("bookings")[0],
      sendTelegram: async () => ({ ok: true, result: { message_id: 9 } }),
      supabase,
    });

    assert.equal(retried.sent, true);
    assert.equal(supabase.rows("bookings")[0].captain_status, "message_sent");
  });

  it("does not ask the captain about a booking that is no longer pending", async () => {
    const { booking, supabase } = setup({
      bookingOverrides: { booking_status: "cancelled" },
    });
    let sendCount = 0;

    const result = await sendCaptainBookingRequest({
      booking,
      sendTelegram: async () => {
        sendCount += 1;
        return { ok: true };
      },
      supabase,
    });

    assert.equal(result.sent, false);
    assert.equal(sendCount, 0);
  });
});
