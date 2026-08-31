# Phase 9G enhancement — Branch-aware POS payment methods

This enhancement remains inside Phase 9. It introduces neither Phase 10, tenancy, nor another Branch model.

## Architecture

`payment_gateways`, Bank Accounts, and Billplz Payment Options remain global online Ecommerce/Booking configuration. POS Credit Card records an externally operated physical terminal payment; it is not Billplz Card. No online controller or shop is changed.

POS identity is global in `pos_payment_methods` (`cash`, `qrpay`, `credit_card`, `customer_balance`). `store_location_pos_payment_methods` stores only Branch availability and display order against existing `store_locations`. Split payment and Auto Calculate Split are transaction-local POS UI behavior, not Branch configuration. Disabling a method affects new transactions only and never rewrites historical `orders.payment_method`.

## Runtime and security

A specific Header Branch loads its POS configuration once for checkout. ALL is rejected as a settings/operational context. Appointment Settlement loads from `booking.store_location_id`, including under Header ALL, never from Staff or ALL.

Backend enforcement runs after persisted Cart/Booking resolution and canonical payment-row resolution. Crafted disabled-method requests are rejected; valid split rows remain governed by the original reconciliation, amount, Cash Shift, and Customer Balance rules. Settings reads/writes use `StoreLocationAccessService` and `pos.payment-method-settings.view/update`; the additive seeder grants both to `infra_core_x1`.

Availability does not replace existing eligibility: enabled Cash still requires the exact Branch open Cash Shift; Customer Balance still requires the existing member, wallet ownership and sufficient balance. Settlement math and reports are unchanged.

## Rollout

The migration creates definitions but guesses no historical Branch. A new/unconfigured Branch deterministically exposes Cash only and returns `is_configured=false`; saving the settings screen materializes its reviewed configuration.

```bash
php artisan db:seed --class=PosPaymentMethodPermissionSeeder
php artisan pos-payment-methods:initialize --store-code=PNG --dry-run
php artisan pos-payment-methods:initialize --store-code=PNG --force
```

The initializer enables the four legacy identities only for the named immutable Branch code, preserves existing configuration unless `--force` is explicit, and never clones PNG. Future Branches must be explicitly reviewed at **POS Settings → POS Payment Methods**.

Production rollout: back up, migrate, seed permission, dry-run/initialize PNG, assign operational permissions, test Cash with/without PNG shift and member Customer Balance, configure every additional Branch, test appointments from Header ALL, and smoke-test both online shops. Migration rollback removes only new configuration data and never changes Orders or online gateway data.

## Phase 9G bootstrap paths and DatabaseSeeder audit (2026-08-31)

### Fresh new customer

```bash
php artisan migrate:fresh --seed
```

This is now a commercial minimum bootstrap. It deterministically creates the configured default Branch using `multi_branch.fresh_install_store_code` (PNG unless configured), the base roles/permissions and `infra_core_x1`, global system settings, four POS method identities, the POS settings permissions, four enabled explicit rows for that Branch, and no Branch split-preference record. No POS initializer is needed for that default Branch. Re-running `db:seed` is missing-only for POS configuration and preserves operator customization.

### Existing production upgrade

```bash
php artisan migrate
php artisan db:seed --class=PosPaymentMethodPermissionSeeder
php artisan pos-payment-methods:initialize --store-code=PNG --dry-run
# review the selected immutable Branch code and proposed action
php artisan pos-payment-methods:initialize --store-code=PNG --force
php artisan pos-payment-methods:initialize --store-code=PNG --dry-run
```

Migrations create identities/schema only and never choose a production Branch. The final dry-run reports `no writes (already configured)`. The production reconciliation command is not called by `DatabaseSeeder`.

### Branch created later

A later CRM-created Branch is deliberately not cloned. Until reviewed it reports `is_configured=false` with Cash-only runtime fallback. Configure it in CRM or explicitly run:

```bash
php artisan pos-payment-methods:initialize --store-code=XXXX --dry-run
php artisan pos-payment-methods:initialize --store-code=XXXX --force
```

Without `--force`, an already explicit configuration is a successful no-op and custom values are preserved. `--force` is an explicit destructive replacement for the named Branch only.

### DatabaseSeeder classification

The previous automatic chain was not commercially safe: its default profile created two Branches and ended by running `FreshInstallMultiBranchQaDataSeeder`; it also ran `ExpenseDemoSeeder`, `FreshInstallGlobalQaCatalogSeeder`, assignment fixtures and shared/Branch QA administrator fixtures.

**SAFE MINIMUM BOOTSTRAP (automatic):** base RBAC (`PermissionSeeder`, Admin/customer/platform role and user seeders), the existing permission-only patch seeders, `StoreLocationsSeederReal`, `BranchAccessDefaultStoreLocationSeeder`, global SEO/Setting/Branch Limit/Shipping/Invoice/Loyalty/Membership/Booking defaults, online gateway definitions, `PosPaymentMethodDefinitionSeeder`, `PosPaymentMethodPermissionSeeder`, `FreshInstallPosPaymentMethodSeeder`, and `PosBranchOperationalSeeder`. Permission patches run before the final `infra_core_x1` role sync so the platform role receives the complete current permission set.

**DEV/QA ONLY (removed from automatic execution):** `FreshInstallBranchOneSeeder`, `FreshInstallBranchTwoSeeder`, `FreshInstallSharedBranchAdminSeeder`, `FreshInstallGlobalQaCatalogSeeder`, `FreshInstallMultiBranchQaDataSeeder`, `ExpenseDemoSeeder`, `BookingBranchAssignmentSeeder`, and `ProductBranchAssignmentSeeder`. These remain available as explicit fixtures/tools.

**LEGACY / SHOULD NOT AUTO-RUN:** production backfill/reconciliation commands and commented testing/demo seeders remain explicit and are not invoked.

**REQUIRES MULTI-BRANCH UPDATE before any future automatic use:** any legacy catalogue, Staff, Booking, Order, Expense, assignment, or transaction fixture that assumes a first Branch or creates synthetic operational ownership. No such fixture is in the commercial automatic chain.

## UX simplification: transaction-local split behavior

After UX review, Phase 9G Branch configuration was intentionally reduced to enabled methods and sort order. The obsolete one-to-one Branch split-settings table is removed by corrective migration `2027_03_04_000002`, which is safe for databases that already ran the original Phase 9G migration. POS Checkout retains its original per-transaction Auto Calculate Split checkbox, defaulting checked, and split amounts. Appointment Settlement retains its original per-transaction multi-method amount entry; it did not have a Phase-9G-independent Auto Calculate preference. Both surfaces filter and order methods by the persisted Cart/Booking Branch. The backend no longer applies a Branch split policy, while all original reconciliation, Cash Shift, Customer Balance, Branch ownership, and enabled-method enforcement remains.
