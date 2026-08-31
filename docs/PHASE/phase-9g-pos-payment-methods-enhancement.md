# Phase 9G enhancement — Branch-aware POS payment methods

This enhancement remains inside Phase 9. It introduces neither Phase 10, tenancy, nor another Branch model.

## Architecture

`payment_gateways`, Bank Accounts, and Billplz Payment Options remain global online Ecommerce/Booking configuration. POS Credit Card records an externally operated physical terminal payment; it is not Billplz Card. No online controller or shop is changed.

POS identity is global in `pos_payment_methods` (`cash`, `qrpay`, `credit_card`, `customer_balance`). `store_location_pos_payment_methods` stores only Branch availability/order against existing `store_locations`; `store_location_pos_payment_settings` stores `allow_split_payment` and the UI `auto_calculate_split` default. Disabling affects new transactions only and never rewrites historical `orders.payment_method`.

## Runtime and security

A specific Header Branch loads its POS configuration once for checkout. ALL is rejected as a settings/operational context. Appointment Settlement loads from `booking.store_location_id`, including under Header ALL, never from Staff or ALL.

Backend enforcement runs after persisted Cart/Booking resolution and canonical payment-row resolution. Crafted disabled-method and forbidden split requests are rejected. Settings reads/writes use `StoreLocationAccessService` and `pos.payment-method-settings.view/update`; the additive seeder grants both to `infra_core_x1`.

Availability does not replace existing eligibility: enabled Cash still requires the exact Branch open Cash Shift; Customer Balance still requires the existing member, wallet ownership and sufficient balance. Settlement math and reports are unchanged.

## Rollout

The migration creates definitions but guesses no historical Branch. A new/unconfigured Branch deterministically exposes Cash only and returns `is_configured=false`; saving the settings screen materializes its reviewed configuration.

```bash
php artisan db:seed --class=PosPaymentMethodPermissionSeeder
php artisan pos-payment-methods:initialize --store-code=PNG --dry-run
php artisan pos-payment-methods:initialize --store-code=PNG --force
```

The initializer enables the four legacy identities only for the named immutable Branch code, refuses replacement without `--force`, and never clones PNG. Future Branches must be explicitly reviewed at **POS Settings → POS Payment Methods**.

Production rollout: back up, migrate, seed permission, dry-run/initialize PNG, assign operational permissions, test Cash with/without PNG shift and member Customer Balance, configure every additional Branch, test appointments from Header ALL, and smoke-test both online shops. Migration rollback removes only new configuration data and never changes Orders or online gateway data.
