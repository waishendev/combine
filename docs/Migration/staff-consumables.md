# Staff Consumables migration notes

Run these commands from the repository root during staging/production deployment.

```bash
cd backend/ecommerce_gentlegurl_backend_api
php artisan migrate
php artisan db:seed --class=StaffConsumablePermissionSeeder
```

The `StaffConsumablePermissionSeeder` is safe for existing databases:

- It uses upsert-style permission writes.
- It does **not** truncate tables.
- It does **not** delete roles, users, products, orders, or stock movement history.
- It attaches staff consumable access/checkout to the Staff role without detaching existing permissions.
- It attaches all staff consumable permissions to admin-style roles when those roles exist.

## DO NOT RUN

```bash
php artisan migrate:fresh --seed
```

`migrate:fresh --seed` drops existing tables and wipes data. Do not use it for this feature in staging or production.

## Feature separation

- Staff self-history is available at `/staff-consumables/history` and only shows the current logged-in staff member's own consumable claims.
- The Staff Consumables claim page remains `/staff-consumables`.
- Admin/global audit logs remain under Logs at `/logs/staff-consumables` and require `pos.staff_consumables.view_logs`.
- Staff self-history does not grant access to other staff records.
