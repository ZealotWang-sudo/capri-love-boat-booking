# Capri Love Boat Production E2E Test Checklist

Use this checklist before and after production deployments. Run tests with a real browser, production environment variables, Supabase production data, Resend production sender, and Stripe test mode unless explicitly testing live payments.

## 1. Booking Request

- [ ] Open `/en/book`, `/zh/book`, and `/it/book`.
- [ ] Confirm the booking page loads without console errors.
- [ ] Select a tour type and confirm the calendar appears only after tour selection.
- [ ] Confirm available, partly booked, fully booked, and unavailable calendar states display correctly.
- [ ] Select an available date and time.
- [ ] Submit a valid booking with name, matching emails, phone, guest count, tour, date, time, and optional message.
- [ ] Confirm the thank-you page appears.
- [ ] Confirm the thank-you summary shows reference code, customer details, tour, date, exact time, price, reservation fee, and pay-on-board amount.
- [ ] Confirm a conflicting booking request for the same tour/time is rejected with a friendly error.

## 2. Email Received

- [ ] Confirm the customer receives the `booking_received` email.
- [ ] Confirm the email language matches the booking locale.
- [ ] Confirm email details match the booking request.
- [ ] Confirm the email contains a manage button, not a raw URL.
- [ ] Confirm no duplicate email is logged for the same booking/event.
- [ ] Confirm `booking_email_events` has a `sent` row for `booking_received`.

## 3. Manage Link

- [ ] Open the manage booking link from the customer email.
- [ ] Confirm the page loads with the booking summary.
- [ ] Confirm invalid token or wrong booking ID shows an invalid/expired link message.
- [ ] Confirm the manage page uses the correct language.
- [ ] Confirm the exact selected departure time is shown.
- [ ] Confirm cancellable statuses show the customer cancel option.
- [ ] Confirm confirmed/completed/closed statuses do not allow customer self-cancellation.

## 4. Admin Status Updates

- [ ] Log in at `/admin/login`.
- [ ] Refresh `/admin` and confirm the session persists.
- [ ] Confirm unauthorized users cannot access the admin dashboard.
- [ ] Confirm bookings are grouped correctly: Needs action, Waiting for customer, Upcoming confirmed trips, Completed trips, Closed/cancelled.
- [ ] Open booking details and confirm all customer, price, status, cancellation, and reference-code information is visible.
- [ ] Confirm captain message copy button works.
- [ ] Confirm status actions show the custom warning modal.
- [ ] Confirm status updates do not redirect unexpectedly to login.

## 5. Captain Available

- [ ] From a `requested` booking, mark it as checking with captain.
- [ ] From `checking_with_captain`, click Captain available.
- [ ] Confirm booking status becomes `payment_pending`.
- [ ] Confirm captain status becomes `available`.
- [ ] Confirm payment status remains `unpaid` until Stripe link creation/payment.
- [ ] Confirm the customer receives the `payment_pending` email.
- [ ] Confirm the manage link shows the reservation payment section.

## 6. Stripe Payment

- [ ] Open the customer manage link for a `payment_pending` booking.
- [ ] Click the payment button.
- [ ] Confirm Stripe Checkout opens.
- [ ] Confirm Stripe amount equals `reservation_fee_eur` only.
- [ ] Confirm customer details and booking reference are present where expected.
- [ ] Return without paying and confirm the payment button can be clicked again.
- [ ] Complete payment with a Stripe test card.

## 7. Webhook Confirmation

- [ ] Confirm Stripe webhook receives `checkout.session.completed`.
- [ ] Confirm booking status becomes `confirmed`.
- [ ] Confirm payment status becomes `captured`.
- [ ] Confirm Stripe checkout session ID and payment intent ID are stored.
- [ ] Confirm confirmation email is sent once.
- [ ] Refresh the manage page and confirm it shows reservation fee received.
- [ ] Confirm webhook retry/idempotency does not send duplicate confirmation emails.

## 8. Cancellation Flow

- [ ] Customer cancels a cancellable booking from the manage page with an optional reason.
- [ ] Confirm status becomes `cancelled`.
- [ ] Confirm `customer_cancelled_at` and `customer_cancel_reason` are stored.
- [ ] Confirm cancellation email highlights the cancellation reason.
- [ ] Admin cancels a booking with cancellation type and reason.
- [ ] Confirm `cancelled_at`, `cancelled_by`, `cancellation_type`, and `cancellation_reason` are stored.
- [ ] Confirm paid bookings show the manual Stripe refund warning before admin cancellation.
- [ ] Confirm no automatic Stripe refund is attempted.

## 9. Completed Flow

- [ ] From a confirmed booking, mark trip completed.
- [ ] Confirm booking status becomes `completed`.
- [ ] Confirm completed booking moves to Completed trips.
- [ ] Confirm the customer receives the completed/thank-you email.
- [ ] Confirm completed bookings no longer show normal action buttons.

## 10. Security Checks

- [ ] Anonymous users can submit booking requests but cannot read bookings from Supabase.
- [ ] Anonymous users cannot update or delete bookings.
- [ ] Customer manage RPC requires correct booking ID and token.
- [ ] Customer cancellation only works for allowed statuses.
- [ ] Admin dashboard requires Supabase Auth session.
- [ ] Only `wangkexin-personal@outlook.com` can access admin operations.
- [ ] Service role key is used only server-side and never exposed to client bundles.
- [ ] Stripe secret key and webhook secret are server-only.
- [ ] Resend API key is server-only.
- [ ] `/admin/logout` only signs out on explicit POST from the sign-out button.
- [ ] Production cookies persist across refresh on `https://capriloveboat.com`.
