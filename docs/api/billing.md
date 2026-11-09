# Billing API (`/api/v1`)

All amounts are integers in **paise**; list prices are GST-inclusive.

### `GET /plans` (public)
`PlanItem[]` — `{ id, code, name, tagline, description, prices: [{ id, interval, amountPaise, currency, monthlyEquivalentPaise }], entitlements }`.

### `POST /billing/coupon-preview` (auth)
Body `{ planCode, interval, couponCode }` → `CouponPreview { code, description, listAmountPaise, discountPaise, amountPaise, gstPaise }`. 422 with a friendly message for invalid/expired/exhausted/used/ineligible coupons. Rate limited 20 / 10 min.

### `POST /billing/checkout` (auth)
Body `{ planCode: 'plus'|'premium'|'elite', interval, couponCode?, billingState?, gstin? }` → `CheckoutOrder { paymentId, razorpayOrderId, razorpayKeyId, amountPaise, currency, listAmountPaise, discountPaise, gstPaise, planName, prefill }`.
Errors: `503 service_unconfigured` (Razorpay keys missing), `403 feature_disabled` (flag `payments` off), `409 conflict` (lower plan while a higher plan is active), `404` unknown plan/interval. GST: CGST+SGST when `billingState` equals the seller state (or is blank), otherwise IGST.

### `POST /billing/verify` (auth)
Body `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`. Verifies HMAC (timing-safe), confirms with Razorpay that the payment belongs to the order and amount, then activates. Idempotent: returns `{ already: true, ... }` on repeats. Response `{ already, subscriptionId, invoiceId, invoiceNumber?, periodEnd?, planName?, status: 'active' }`.

Activation rules: same plan → extends from current end; different (higher) plan → new period starts now and the previous subscription is cancelled; downgrades are refused at checkout.

### `GET /billing/history` (auth, allowed while suspended)
`BillingHistoryResponse { plan, payments[], invoices[], refunds[] }`.

### `GET /billing/invoices/:id` (owner, or admin with `payments.read`)
JSON invoice row; `?format=html` returns a printable GST tax invoice (seller details from `platform_settings.gst`, SAC 998439, CGST/SGST or IGST, amount in words).

### `POST /webhooks/razorpay` (no auth; signature required)
Header `X-Razorpay-Signature` = HMAC-SHA256(raw body, `RAZORPAY_WEBHOOK_SECRET`). Idempotent by `x-razorpay-event-id`. Handles `payment.captured`, `order.paid` (activation; amount must match), `payment.failed`, `refund.processed`, `refund.failed`. Returns 401 for bad signatures, 500 on processing errors (Razorpay retries), 200 otherwise.

### Cron (`/api/cron/daily`, `/api/cron/hourly`)
`Authorization: Bearer $CRON_SECRET`. Response `{ ok, jobs: [{ name, ok, ms, result?, error? }] }`; HTTP 207 when any job failed.

### Server functions used by other modules
- `processRefund(refundId, auth)` — `server/billing/refunds.ts` (admin refund approval).
- `activatePayment(paymentId, razorpayPaymentId, method, source)` — `server/billing/activation.ts`.
