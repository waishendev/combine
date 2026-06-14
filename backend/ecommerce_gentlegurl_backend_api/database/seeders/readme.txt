php artisan db:seed --class=BookingLandingPageVisitStudioWhatsAppSeeder

# Ecommerce landing page (Visit Our Studio on shop homepage)
php artisan migrate --path=database/migrations/2026_06_14_000001_create_ecommerce_landing_pages_table.php
php artisan db:seed --class=EcommerceLandingPageLaunchSeeder
