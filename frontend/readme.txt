================================================================
  IMAGE COMPRESSION - SETUP & USAGE
================================================================

1. COMPRESS EXISTING IMAGES (One-time batch, run on server)
----------------------------------------------------------------

  Step 1: Preview first (safe, no changes made)

    php artisan images:compress --dry-run

  Step 2: Compress only products (recommended to start here, 1000+ images)

    php artisan images:compress --dir=products

  Step 3: Compress all remaining directories

    php artisan images:compress --dir=booking-products
    php artisan images:compress --dir=booking-services
    php artisan images:compress --dir=sliders
    php artisan images:compress --dir=announcements
    php artisan images:compress --dir=booking-landing

  Or compress everything at once:

    php artisan images:compress

  Options:
    --dry-run         Preview without modifying files
    --dir=products    Only compress a specific directory
    --max-width=1920  Max width (default 1920)
    --max-height=1920 Max height (default 1920)
    --quality=82      JPEG quality 1-100 (default 82)
    --min-size=500    Only compress files > X KB (default 500)

  Notes:
    - Requires PHP GD extension (already added to Dockerfile-prod)
    - Safe to interrupt and re-run
    - Skips files already under 500KB
    - Won't overwrite if compressed result is larger
    - Preserves transparent PNGs
    - Aspect ratio always maintained (e.g. 400x400 -> 200x200, never distorted)
    - Shows progress bar and summary at the end
    - If PNG support missing, PNG files are auto-skipped (not errors)

  Docker rebuild required (one-time, GD extension added):

    docker compose -f docker-compose-prod.yml build --no-cache laravel-app
    docker compose -f docker-compose-prod.yml up -d laravel-app laravel-queue

  Then run the compress command inside the container:

    docker compose -f docker-compose-prod.yml exec laravel-app \
      php artisan images:compress --dry-run

    docker compose -f docker-compose-prod.yml exec laravel-app \
      php artisan images:compress


2. NEW UPLOADS (Automatic, no action needed)
----------------------------------------------------------------

  All CRM upload points now auto-compress images before sending
  to the server. This applies to:

    - Product create/edit (images, variants, meta OG)
    - Booking product create/edit
    - Booking service create/edit
    - Slider create/edit (desktop + mobile)
    - Announcement create/edit
    - Booking landing page editor (all sections)

  Settings: max 1920x1920, JPEG quality 82%, skip files < 500KB
  Transparent PNGs are preserved as PNG.
  SVG and GIF files are not compressed.

  No action needed - compression runs automatically in the browser
  before upload.


3. SHOP FRONTEND (Automatic, no action needed)
----------------------------------------------------------------

  Booking shop pages (BookingPageContent, service detail page)
  now use Next.js <Image> instead of raw <img> tags.
  This automatically serves:

    - Properly sized images based on screen size
    - WebP/AVIF format where supported
    - Lazy loading for off-screen images

  No action needed - handled by Next.js automatically.

================================================================
