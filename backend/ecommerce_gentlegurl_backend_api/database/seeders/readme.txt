php artisan db:seed --class=BookingLandingPageVisitStudioWhatsAppSeeder

# Ecommerce landing page (Visit Our Studio on shop homepage)
php artisan migrate --path=database/migrations/2026_06_14_000001_create_ecommerce_landing_pages_table.php
php artisan db:seed --class=EcommerceLandingPageLaunchSeeder

# Booking staff schedules — Active/Inactive per weekday (affects POS + shop availability)
php artisan migrate --path=database/migrations/2026_06_14_000002_add_is_active_to_booking_staff_schedules_table.php

# Leave calendar — off-day edit/cancel activity log action type "updated"
php artisan migrate --path=database/migrations/2026_06_14_000003_add_updated_to_booking_leave_log_action_type.php
