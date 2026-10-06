# Billing setup (Stripe, test mode)

Listeners subscribe to a single track or to a program, monthly or yearly. Stripe is the source of truth: our `subscriptions` and `invoices` tables only mirror what Stripe tells us through webhooks. Nothing grants access from a browser redirect.

## 1. Keys and environment

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WEB_ORIGIN=http://localhost:5173     # checkout and portal return here
```

Without `STRIPE_SECRET_KEY`, checkout, the portal and admin pricing answer `503 Payments are not configured`. Without `STRIPE_WEBHOOK_SECRET` the webhook answers `503`. The rest of the app keeps working, and the tests use an in-memory payment provider.

## 2. Webhook endpoint

`POST /billing/webhook`. Register these events:

| Event | What it does |
|---|---|
| `customer.subscription.created` / `.updated` / `.deleted` | creates or updates the subscription: status, paid period, "cancel at period end" |
| `invoice.paid` / `invoice.payment_failed` / `invoice.voided` / `invoice.marked_uncollectible` | records the invoice (revenue statistics are built from these) |
| `charge.refunded` | records the refunded amount against the invoice |

Any other event is acknowledged and ignored.

**Local development** with the Stripe CLI:

```bash
stripe listen --forward-to localhost:4000/billing/webhook
# it prints a whsec_... secret: put it in STRIPE_WEBHOOK_SECRET
stripe trigger customer.subscription.created   # or complete a real test checkout
```

How a delivery is treated:

- The signature is verified over the exact raw body (5 minute tolerance, so a captured request cannot be replayed later).
- The Stripe event id is the key in `stripe_events`: an event already processed is acknowledged without being applied again.
- A failure returns `500` so Stripe retries (for up to 3 days). Failed events stay in `stripe_events` with `status = FAILED` and a one-line reason.
- Only a reference to the object is stored, never the payload, because it carries personal data.
- Events may arrive out of order. Subscription changes are upserts, and an invoice that arrives before its subscription fetches the subscription first.

## 3. Customer portal

Cancelling, switching plan and updating a card happen on Stripe's hosted portal (`POST /billing/portal`). Turn it on once in the Stripe dashboard: Settings → Billing → Customer portal. Allow at least "Cancel subscriptions" and "Update payment methods". Cancelling at the end of the period keeps access until the period ends, and that is what the library shows ("ends on ...").

## 4. Putting something on sale

An admin sets prices per item, in cents (USD):

```
PUT /admin/tracks/:id/prices     { "monthlyAmountMinor": 999, "yearlyAmountMinor": 9900 }
PUT /admin/programs/:id/prices   { "monthlyAmountMinor": 1999, "yearlyAmountMinor": null }
```

- Both fields are required. `null` takes that interval off sale.
- Between $0.50 and $10,000.
- The first price creates the Stripe product. Stripe prices cannot be edited, so a change puts a new price on sale and archives the old one. People already subscribed stay on the price they bought.
- Setting the same amounts again does nothing.
- An item can be priced before it is published; it can only be **bought** once it is published.

## 5. How a purchase works

1. `POST /billing/checkout` with `{ trackId | programId, interval }`. The server takes the price from its own table, creates the Stripe customer on the first purchase, and returns a Stripe-hosted checkout URL. The browser goes there.
2. The listener pays. Stripe sends `customer.subscription.created` and `invoice.paid`.
3. The webhook records the subscription. The item appears in `GET /library`, and `POST /stream/tracks/:id/url` starts returning links.

Opening checkout grants nothing. Until the webhook arrives the library is unchanged, so the web app should poll or refresh `/library` after returning from checkout.

## 6. Who can play what (one rule, one place)

`AccessService` is the only code that decides. A listener may play a track when **any** of these is true:

1. a subscription to the track is active;
2. a subscription to a program that contains the track is active;
3. an admin granted the track or such a program, and the grant is not revoked or expired.

A subscription counts when its status is `ACTIVE` or `TRIALING`. `PAST_DUE`, `UNPAID`, `INCOMPLETE`, `PAUSED` and `CANCELED` block immediately. Content that has since been archived stays playable for people who subscribed to it.

An `ACTIVE` subscription whose paid period ended more than 6 hours ago is not trusted any more. Renewals normally arrive within minutes; a longer gap means webhooks are being missed, and this stops access running on forever.

## 7. Manual access

`POST /admin/access-grants` with `{ userEmail, trackId | programId, source: "ADMIN" | "PROMO", expiresAt?, note? }`, and `POST /admin/access-grants/:id/revoke`. Every grant is attributed to the admin and audited.

## Known gaps

- Renaming an item does not rename its Stripe product.
- If a listener pays twice through two checkouts, the second subscription is cancelled automatically, but refunding the extra charge is manual.
- Refunds are recorded; there is no admin refund action. Refund in the Stripe dashboard.
- Trials, coupons and tax are not configured. Promotion codes are allowed at checkout once you create them in Stripe.
- The statistics endpoints (revenue, top tracks) come in a later step; the data they need (`invoices`) is already being recorded.
