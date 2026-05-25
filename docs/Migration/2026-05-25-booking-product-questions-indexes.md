# Booking Product Questions / Add-ons – Index Migration

Date: 2026-05-25

## Purpose

Adds missing composite indexes for Booking Product Questions / Add-ons tables:

- `booking_product_questions (booking_product_id, is_active)`
- `booking_product_question_options (booking_product_question_id, is_active)`

This migration is **additive** and safe for live data.

## Safe Commands

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate
```

Rollback only this migration (if needed):

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate:rollback --path=database/migrations/2026_05_25_120000_add_indexes_to_booking_product_questions_tables.php
```

## Notes

- Do **not** use `php artisan migrate:fresh --seed` on live data.
- This change does not alter booking duration/time logic.
- Booking Product add-ons remain price-only behavior.
