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
