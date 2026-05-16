# Booking feedback email setting — deployment notes

Run from the repository root on **staging/production** when the CRM setting row does not exist yet.

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan db:seed --class=BookingFeedbackEmailSettingSeeder
```

`BookingFeedbackEmailSettingSeeder` is safe for existing databases:

- It uses `firstOrCreate` — **only inserts** when `type=booking` and `key=booking_feedback_email` is missing.
- It does **not** truncate tables.
- It does **not** overwrite an existing `booking_feedback_email` value (e.g. after admins change enabled / send time in CRM).

Optional: ensure the scheduler sends feedback emails (if not already scheduled):

```bash
php artisan schedule:list
```

The command is `booking:send-feedback-emails` (see `routes/console.php` or `bootstrap/app.php`).

## DO NOT RUN

```bash
php artisan migrate:fresh --seed
php artisan db:seed --class=SettingSeeder
```

- `migrate:fresh --seed` drops tables and wipes data.
- Full `SettingSeeder` may reset many shop/booking settings via `updateOrCreate`; use `BookingFeedbackEmailSettingSeeder` instead for this feature on live DBs.

## CRM

After seeding, configure under shop/booking settings (e.g. **Booking feedback email** card) — defaults: enabled, send at `10:00`.
