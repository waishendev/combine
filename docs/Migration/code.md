# POS Booking Settlement Per-Line Discounts

Migration filename:

- `backend/ecommerce_gentlegurl_backend_api/database/migrations/2026_05_15_000001_add_discount_lines_to_pos_cart_appointment_settlement_items.php`

```bash
# Run only normal migrations
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate

# Roll back the last migration batch if this migration was the only latest batch item
php artisan migrate:rollback --step=1

# Do NOT run:
php artisan migrate:fresh --seed
```

Notes:

- This is a safe additive migration that adds nullable JSON column `discount_lines` to `pos_cart_appointment_settlement_items`.
- `discount_lines` stores per booking settlement service/add-on line discount metadata while preserving existing product discount behavior.
- `php artisan migrate:fresh --seed` must NOT be used because it drops existing data.

# POS Cart Booking Product and Service Package Discounts

Migration filename:

- `backend/ecommerce_gentlegurl_backend_api/database/migrations/2026_05_15_000002_add_discount_totals_to_pos_cart_line_items.php`

```bash
# Run only normal migrations
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate

# Do NOT run:
php artisan migrate:fresh --seed
```

Notes:

- This is a safe additive migration for POS cart line-item discount metadata.
- It ensures `pos_cart_package_items` has `discount_type`, `discount_value`, `discount_amount`, `discount_remark`, and `line_total_after_discount` for Service Package discounts.
- It also ensures `pos_cart_items` has the same discount total fields so Booking Product cart lines can share normal product discount behavior.
- Existing records default discount totals to zero. `php artisan migrate:fresh --seed` must NOT be used because it drops existing data.

# Booking Service Photos

Migration filename:

- `backend/ecommerce_gentlegurl_backend_api/database/migrations/2026_05_16_000001_create_booking_service_photos_table.php`

```bash
# Run only normal migrations
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate

# Do NOT run:
php artisan migrate:fresh --seed
```

Notes:

- Adds `booking_service_photos` for salon/admin service result photos linked by `booking_id`.
- This table is separate from customer reference photo uploads and must not be treated as order-level media.
- `php artisan migrate:fresh --seed` must NOT be used because it drops existing data.
