# Booking Product questions/add-ons + Chinese name support

## Run migration
```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate
```

## DO NOT RUN
```bash
php artisan migrate:fresh --seed
```

## Notes
- Additive migrations only, safe for existing data.
- Booking Product options are pricing add-ons only.
- Booking Product options do not add appointment duration/time.
