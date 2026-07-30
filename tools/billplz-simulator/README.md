# Billplz local payment simulator

This development-only service replaces the external Billplz HTTP service while leaving Laravel's existing payment processing unchanged. It provides an in-memory Billplz-compatible create/get-bill API, a hosted payment page, signed callbacks, and signed browser redirects. Restarting it loses bills, callback history, and scheduled callbacks.

## Contract used by this application

The Laravel `BillplzService` sends an `application/x-www-form-urlencoded` request with HTTP Basic authentication to `{base_url}/bills`. Its fields are `collection_id`, `email` and/or `mobile`, `name`, integer-cent `amount`, `description`, `callback_url`, `redirect_url`, and reference labels/values. Direct FPX/card routing puts the gateway code in `reference_1` and the order number in `reference_2`; generic routing puts the order number in `reference_1`.

Callbacks are flat URL-encoded fields. Their signature source is a case-insensitive key sort followed by `key + value` strings joined with `|`. Redirects use nested `billplz[...]` query parameters and sign case-insensitively sorted `billplz + key + value` strings. Both signatures use HMAC-SHA256 and the configured x-signature key. Online Banking and Credit Card are stored only as simulator metadata; no invented payment-method field is sent to Laravel.

Both ecommerce and booking create an order before requesting a Billplz bill, navigate to the returned hosted URL, and use the same existing Laravel callback/redirect controller. The simulator communicates only with those URLs and never accesses the Laravel database.

## Installation and commands

```bash
cd tools/billplz-simulator
npm install
cp .env.example .env
npm run dev
```

Available checks and production-style startup:

```bash
npm run typecheck
npm test
npm run build
npm start
```

`npm start` runs the previously built `dist/index.js`.

## Simulator environment

```dotenv
PORT=4400
SIMULATOR_PUBLIC_URL=http://127.0.0.1:4400
BILLPLZ_API_KEY=local-api-key
BILLPLZ_X_SIGNATURE_KEY=local-signature-key
CALLBACK_TIMEOUT_MS=5000
```

The API is `http://127.0.0.1:4400/api/v3`, health is `http://127.0.0.1:4400/health`, and hosted bills are at `http://127.0.0.1:4400/bills/{billId}`.

## Local environment setup

### Laravel

1. Copy the relevant entries from `backend/ecommerce_gentlegurl_backend_api/.env.billplz-simulator.example` into the backend's local `.env`.
2. Clear cached configuration:

   ```bash
   php artisan optimize:clear
   ```

3. Verify the values Laravel resolved:

   ```bash
   php artisan tinker
   ```

   ```php
   config('services.billplz.base_url');
   config('services.billplz.api_key');
   config('services.billplz.x_signature');
   ```

Do not print real credentials in screenshots, shared terminal output, or logs. Local database payment-gateway records may override these environment values, so check both the ecommerce and booking gateway configuration when the resolved result is unexpected.

### Simulator

1. Copy `.env.example` to `.env`.
2. Run `npm install` and `npm run dev`.
3. Open `http://127.0.0.1:4400/health` and confirm it returns `{"ok":true}`.

The Laravel `BILPLZ_API_KEY` must equal the simulator `BILLPLZ_API_KEY`, and Laravel `BILPLZ_X_SIGNATURE` must equal simulator `BILLPLZ_X_SIGNATURE_KEY`.

### Postman

1. Import `postman/Billplz-Simulator.postman_collection.json`.
2. Import `postman/Billplz-Simulator-Local.postman_environment.json`.
3. Select **Billplz Simulator Local** as the active environment.
4. Run **Health Check**.
5. Run **Create Bill**; its test script saves `bill_id` and `hosted_payment_url`.
6. Run **Get Bill**.
7. Open `{{hosted_payment_url}}` (or copy its saved environment value into a browser).
8. Select the required callback or redirect scenario on the hosted page.

Direct callback requests are intentionally omitted from the collection. The hosted page uses the simulator's real signing implementation and avoids stale, hardcoded signatures.

## Laravel configuration

The backend already reads `BILPLZ_BASE_URL`; no Laravel source change is needed. For host-to-host local development, use local-only environment values:

```dotenv
BILPLZ_API_KEY=local-api-key
BILPLZ_COLLECTION_ID=local-collection
BILPLZ_X_SIGNATURE=local-signature-key
BILPLZ_BASE_URL=http://127.0.0.1:4400/api/v3
APP_URL=http://127.0.0.1:8000
FRONTEND_URL_ECOMMERCE=http://127.0.0.1:3000
FRONTEND_URL_BOOKING=http://127.0.0.1:3001
```

Database payment-gateway settings can override environment values. Ensure the active ecommerce and booking Billplz gateway records use the same local API key, collection, x-signature key, and base URL when those records are configured.

### Docker networking

If Laravel is in Docker and the simulator runs on the host:

```dotenv
BILPLZ_BASE_URL=http://host.docker.internal:4400/api/v3
```

If the simulator is in Docker and Laravel runs on the host, the callback URL generated from `APP_URL` must be reachable from the simulator, for example:

```dotenv
APP_URL=http://host.docker.internal:8000
```

When both run on the host, prefer `127.0.0.1` consistently. A container's `127.0.0.1` refers to that container, not the host.

## Ecommerce checkout

1. Start the simulator and Laravel.
2. Start `frontend/ecommerce_gentlegurl_shop` with its existing development command.
3. Open `/checkout`, choose the configured Billplz Online Banking or Credit Card method, and submit checkout.
4. Laravel creates the order, calls the simulator, and sends the browser to `/bills/{billId}`.
5. Choose a hosted-page scenario. Laravel receives the same callback and redirect shapes it already processes for Billplz.
6. Confirm the existing payment-result/order page shows the status produced by Laravel.

## Booking checkout

1. Start the simulator, Laravel, and `frontend/booking_gentlegurl_shop`.
2. Build a booking cart and open `/booking/checkout` (or the application's checkout entry point).
3. Choose Billplz Online Banking or Credit Card and continue.
4. On the hosted simulator page, select a scenario.
5. Confirm the existing booking payment-result page and booking/order history show Laravel's resulting status.

## Hosted-page scenarios

* **Successful Online Banking / Credit Card:** records the internal method, sends a valid paid callback, then redirects.
* **Failed / Cancelled:** sends an unpaid callback and redirects with the unpaid result.
* **Callback then redirect / callback only / redirect only:** independently exercise delivery order.
* **Redirect before callback:** redirects immediately and schedules the callback two seconds later. The scheduled callback is lost if the simulator restarts.
* **Duplicate callbacks:** sends the same signed payload twice.
* **Delayed callback:** schedules delivery after two seconds without redirecting.
* **Invalid callback signature:** corrupts only `x_signature`.
* **Modified callback amount:** explicitly sends the stored amount plus one cent and signs that negative-test payload.
* **Unknown callback bill ID:** substitutes and signs an unknown ID.
* **Connection failure / timeout:** records the failed delivery attempt.
* **Invalid redirect signature / server error:** corrupts redirect signing or returns HTTP 500.

Normal hosted actions never accept a browser-posted amount; they always use the amount stored at bill creation.

## Return to Sandbox or Production

Stop the simulator and restore the environment/database gateway values already used by the deployment. Typical base URLs are:

```dotenv
# Sandbox
BILPLZ_BASE_URL=https://www.billplz-sandbox.com/api/v3

# Production (the backend's existing default)
BILPLZ_BASE_URL=https://www.billplz.com/api/v3
```

Restore the matching Sandbox or Production API key, collection ID, and x-signature key. Never reuse local simulator credentials outside local development. No production controller, callback, redirect, order, booking, wallet, stock, or loyalty behavior is changed by this tool.

After restoring the original URL and credentials, run `php artisan optimize:clear` and verify the resolved configuration again before processing payments.

## Troubleshooting and limitations

* **Connection refused:** open `/health`, verify port `4400`, firewall rules, process topology, and `host.docker.internal` usage.
* **Callback URL unreachable:** `APP_URL` must identify Laravel—not a frontend—and be reachable from the simulator process.
* **Signature mismatch:** use the identical x-signature key in the simulator and the resolved Laravel gateway configuration; check database gateway overrides and clear Laravel's configuration cache after environment changes.
* **Unexpected real Billplz request:** verify the active workspace gateway's `base_url`, then run `php artisan config:clear` where appropriate.
* **CORS:** callbacks and API creation are server-to-server; browser CORS is normally not involved.
* Bills and attempts are in memory. Delayed actions have no durable job queue. The timeout scenario uses a deliberately short deadline. This is not a Billplz Sandbox replacement for provider certification or a production service.
