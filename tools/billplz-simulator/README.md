# Billplz local payment simulator

Development-only, in-memory Billplz-compatible create/get-bill API and hosted payment page. It exercises Laravel's normal signed callback endpoint; it never directly changes application data. Restarting loses bills, attempts, and delayed jobs.

## Application contract discovered

Laravel posts a form with Basic auth to `{base_url}/bills`. Its payload is `collection_id`, contact `email` and/or `mobile`, `name`, integer-cent `amount`, `description`, `callback_url`, `redirect_url`, and reference labels/values. Direct FPX/card routing stores a gateway code in `reference_1` and the order number in `reference_2`; generic bills put the order number in `reference_1`. Laravel consumes `id`, `url`, and bill metadata. The callback is form-encoded with flat Billplz fields and the redirect uses nested `billplz[...]` query parameters.

Callbacks sign case-insensitively sorted `key + value` strings joined by `|`; redirects sign similarly sorted `billplz + key + value` strings. Both use HMAC-SHA256. Existing ecommerce and booking checkouts create the order first, receive a payment URL, and navigate the browser to it. Both share the callback controller and are distinguished by the order's workspace/payment gateway. Online Banking and Credit Card differ in application payment-method/gateway routing but not in Billplz callback fields.

> **Integrity review:** callback confirmation now requires both a valid signature and an exact integer-cent amount match; browser redirects are informational and cannot mark an order paid. Order status checks limit repeated top-level processing, but locking/atomic transition and every downstream side effect were not proven globally and remain recommended follow-up work.

## Install and run

```bash
cd tools/billplz-simulator
npm install
cp .env.example .env
npm run dev
```

Scripts: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`, and `npm start` (after build). API: `http://127.0.0.1:4400/api/v3`; hosted page: `http://127.0.0.1:4400/bills/{id}`; health: `http://127.0.0.1:4400/health`.

## Configuration

Simulator variables are documented in `.env.example`. Use the same local API/signature keys in Laravel, never real credentials:

```dotenv
BILPLZ_API_KEY=local-api-key
BILPLZ_COLLECTION_ID=local-collection
BILPLZ_X_SIGNATURE=local-signature-key
BILPLZ_BASE_URL=http://127.0.0.1:4400/api
APP_URL=http://127.0.0.1:8000
FRONTEND_URL_ECOMMERCE=http://127.0.0.1:3000
FRONTEND_URL_BOOKING=http://127.0.0.1:3001
```

Laravel normalizes a base ending `/api` to `/api/v3`. For sandbox/production keep the existing real host and real credentials; simulator configuration is optional. If Laravel is in Docker, use `BILPLZ_BASE_URL=http://host.docker.internal:4400/api`. If the simulator must call Laravel on the host, make `APP_URL=http://host.docker.internal:8000`. When both are on the host, use `127.0.0.1`. Do not use simulator mode or local keys in production.

Start Laravel with `php artisan serve --host=127.0.0.1 --port=8000`, then each Next.js project with its existing install command and `npm run dev` (choose distinct ports). Complete ecommerce `/checkout` or booking `/booking/checkout`; the returned URL opens the simulator.

## Scenarios

On the hosted page choose **Successful Online Banking** or **Successful Credit Card** to POST a valid callback and redirect. Choose callback-only, redirect-only, redirect-before-callback, duplicate callback, delayed callback, invalid signature, modified amount, unknown ID, unreachable callback, timeout, invalid/failed redirect, or server error. Duplicate sends the same successful callback twice. Modified amount is explicitly one cent above the stored amount; ordinary forms never accept an amount. Redirect-before-callback redirects immediately and schedules the callback two seconds later; callback and redirect remain independent, and the scheduled callback is lost on restart.

Expected safe lifecycle is unpaid/pending until a valid, amount-matching callback changes the order to paid/confirmed and confirms linked bookings. A redirect arriving first should display pending and query order status. Failed/cancelled flows remain unpaid.

## Troubleshooting and limitations

* **Connection refused:** confirm `/health`, ports, firewall, and whether Docker needs `host.docker.internal`.
* **Wrong callback:** `APP_URL` must be reachable from the simulator process and include no frontend URL.
* **Invalid signature:** the simulator and resolved workspace gateway must use identical signature keys; database gateway config can override env config.
* **localhost vs 127.0.0.1:** use `127.0.0.1` consistently; containers cannot reach host loopback.
* **CORS:** browser CORS is normally irrelevant because Laravel calls the API and callbacks are server-to-server.
* Storage and delayed jobs are process-local. Payment methods are simulator metadata only and are not invented callback fields. Callback timeout is approximate and scenario timeout uses an intentionally tiny deadline.
