# Customer Wallet Production Test Runbook

Use this checklist after deploying the customer wallet migrations and code. The CRM wallet buttons and Balance Top Ups approval actions are permission-gated; if the seeder is not run, the UI may hide the action or the backend may return `403 Forbidden`.

## 1. Deploy database changes

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate
```

## 2. Seed wallet permissions

```bash
php artisan db:seed --class=CustomerWalletPermissionSeeder
```

The seeder creates these permissions idempotently:

- `customer_wallet.view`
- `customer_wallet.adjust`
- `customer_wallet.view_transactions`
- `customer_wallet.allow_negative_adjustment`
- `customer_wallet.reverse_transaction`
- `customer_wallet.verify_topup`

It also attaches them to the existing `infra_core_x1` and `superAdmin` roles using `syncWithoutDetaching`, so existing permissions are not removed.

## 3. Clear caches

Run the permission cache reset only if Spatie Permission is installed/enabled in the target environment.

```bash
php artisan permission:cache-reset
php artisan optimize:clear
```

If `permission:cache-reset` is not available, run only:

```bash
php artisan optimize:clear
```

## 4. Verify the logged-in CRM role

Confirm the CRM user/role used for testing has at least:

- `customer_wallet.view` to see Manage Balance
- `customer_wallet.view_transactions` to view wallet logs / pending top-ups
- `customer_wallet.adjust` to Deposit / Withdraw
- `customer_wallet.verify_topup` to Approve / Reject manual-transfer top-ups

## 5. Manual Transfer top-up test

1. Log in as a customer in Booking or Ecommerce shop.
2. Open Account > Customer Balance > Top Up.
3. Select Manual Transfer.
4. Submit a top-up amount, for example RM20.
5. Upload payment proof.
6. Confirm the customer message says the proof is waiting for staff verification.

Expected database state before approval:

```sql
SELECT
    id,
    transaction_no,
    customer_id,
    type,
    direction,
    amount,
    workspace_type,
    payment_gateway_key,
    source_type,
    source_id,
    status,
    metadata,
    created_at,
    completed_at
FROM customer_wallet_transactions
ORDER BY id DESC
LIMIT 20;
```

Expected row values:

- `type = topup`
- `direction = credit`
- `status = waiting_verification` after proof upload
- `completed_at IS NULL`
- `metadata->payment_proof_url` exists
- `workspace_type` is `booking` or `ecommerce`, matching the customer site used

## 6. Request Center approval test

1. Log in to CRM with a role that has `customer_wallet.verify_topup`.
2. Open POS / Request Center.
3. Open the `Balance Top Ups` tab.
4. Confirm the submitted manual-transfer top-up appears.
5. Click `View Details`.
6. Confirm proof metadata/link is visible.
7. Click `Approve Top Up`.

Expected result:

- The top-up disappears from pending Balance Top Ups.
- The transaction status becomes `completed`.
- `customers.wallet_balance` increases once by the top-up amount.
- Repeating approval does not double-credit because the service returns already-completed transactions without adding balance again.

## 7. Manage Balance modal approval test

1. Open CRM > Customers.
2. Confirm the customer row shows the distinct wallet `Balance` action after permissions are seeded.
3. Open Manage Balance.
4. Pending top-ups display in the modal.
5. Approve or Reject from the modal.

If approval/rejection returns `403 Forbidden`, re-check that `CustomerWalletPermissionSeeder` has run and that the current role has `customer_wallet.verify_topup`.

## 8. Deposit / Withdraw test

1. Open Manage Balance.
2. Deposit RM10 with a required reason.
3. Confirm balance increases and a ledger transaction is created.
4. Withdraw RM5 with a required reason.
5. Confirm balance decreases and a ledger transaction is created.

Required permission: `customer_wallet.adjust`.

## 9. Checkout scope check

Customer Balance is not a checkout payment method in this phase. Verify checkout pages still show the existing payment methods only.
