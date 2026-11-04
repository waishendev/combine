<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLandingPage;
use App\Models\Ecommerce\EcommerceLandingPage;
use Illuminate\Database\Seeder;

/**
 * Production-safe: set visit_studio.locations to both real branches
 * (George Town first, Tanjung Tokong second) on booking + ecommerce landing pages.
 *
 * Preserves per-location bottom_label / WhatsApp message / column_order when already set.
 *
 *   php artisan db:seed --class=VisitStudioTanjungTokongSeeder
 */
class VisitStudioTanjungTokongSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedBooking();
        $this->seedEcommerce();
    }

    private function georgeTownLocation(string $whatsappMessage): array
    {
        return [
            'tab_label' => 'George Town',
            'studio_name' => 'Gentlegurls Nail Salon',
            'address' => "14, Lebuh Cintra\nGeorge Town, 10200 George Town\nPulau Pinang",
            'google_maps_url' => 'https://maps.app.goo.gl/49X3Uig3nnXjXY786',
            'waze_url' => 'https://ul.waze.com/ul?place=ChIJS5oNaHbDSjAR-OBAHI_UO5U&ll=5.41890700%2C100.33394320&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location',
            'whatsapp_phone' => '60103870881',
            'whatsapp_message' => $whatsappMessage,
            'google_maps_label' => 'GOOGLE MAPS',
            'waze_label' => 'OPEN WAZE',
            'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
            'opening_hours_heading' => 'Opening Hours',
            'opening_hours' => [
                [
                    'day_range' => 'Monday — Friday',
                    'time_range' => '11:00 AM — 8:00 PM',
                ],
                [
                    'day_range' => 'Saturday — Sunday',
                    'time_range' => '11:00 AM — 8:00 PM',
                ],
            ],
            'bottom_label' => '',
            'column_order' => 'contact_left',
        ];
    }

    private function tanjungTokongLocation(string $whatsappMessage): array
    {
        return [
            'tab_label' => 'Tanjung Tokong',
            'studio_name' => 'Gentlegurls Nail Salon - Tanjung Tokong',
            'address' => "97-G-19, Jalan Fettes\nPrima Tanjung Business Centre\n10470 Tanjung Tokong, Pulau Pinang",
            'google_maps_url' => 'https://maps.app.goo.gl/WzJXm6JqA9vnC6nT8',
            'waze_url' => 'https://ul.waze.com/ul?q=97-G-19%20Prima%20Tanjung%20Jalan%20Fettes%2C%20Tanjung%20Tokong&navigate=yes',
            'whatsapp_phone' => '60176375513',
            'whatsapp_message' => $whatsappMessage,
            'google_maps_label' => 'GOOGLE MAPS',
            'waze_label' => 'OPEN WAZE',
            'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
            'opening_hours_heading' => 'Opening Hours',
            'opening_hours' => [
                [
                    'day_range' => 'Monday — Friday',
                    'time_range' => '11:00 AM — 8:00 PM',
                ],
                [
                    'day_range' => 'Saturday — Sunday',
                    'time_range' => '11:00 AM — 8:00 PM',
                ],
            ],
            'bottom_label' => '',
            'column_order' => 'contact_left',
        ];
    }

    private function seedBooking(): void
    {
        $page = BookingLandingPage::query()->where('slug', 'home')->first();
        if (! $page) {
            $this->command?->warn('booking_landing_pages slug=home not found. Skipping booking.');

            return;
        }

        $sections = is_array($page->sections) ? $page->sections : [];
        $sections['visit_studio'] = $this->setBothLocations(
            is_array($sections['visit_studio'] ?? null) ? $sections['visit_studio'] : [],
            'Hi! I would like to get in touch about your salon services.',
        );
        $page->sections = $sections;
        $page->save();

        $this->command?->info('booking_landing_pages#'.(int) $page->id.' — George Town + Tanjung Tokong set.');
    }

    private function seedEcommerce(): void
    {
        $page = EcommerceLandingPage::query()->where('slug', 'home')->first();
        if (! $page) {
            $this->command?->warn('ecommerce_landing_pages slug=home not found. Skipping ecommerce.');

            return;
        }

        $sections = is_array($page->sections) ? $page->sections : [];
        $sections['visit_studio'] = $this->setBothLocations(
            is_array($sections['visit_studio'] ?? null) ? $sections['visit_studio'] : [],
            'Hi! I would like to get in touch about your shop.',
        );
        $page->sections = $sections;
        $page->save();

        $this->command?->info('ecommerce_landing_pages#'.(int) $page->id.' — George Town + Tanjung Tokong set.');
    }

    /**
     * @param  array<string, mixed>  $visitStudio
     * @return array<string, mixed>
     */
    private function setBothLocations(array $visitStudio, string $defaultWhatsappMessage): array
    {
        $existing = $this->resolveLocations($visitStudio);
        $georgeTown = $this->mergePreservedFields(
            $this->georgeTownLocation($defaultWhatsappMessage),
            $this->findLocation($existing, ['george town', 'georgetown', 'lebuh cintra', 'cintra']),
        );
        $tanjung = $this->mergePreservedFields(
            $this->tanjungTokongLocation($defaultWhatsappMessage),
            $this->findLocation($existing, ['tanjung tokong', 'prima tanjung', 'jalan fettes']),
        );

        // Always clear legal footer lines for these seeded branches.
        $georgeTown['bottom_label'] = '';
        $tanjung['bottom_label'] = '';

        $visitStudio['locations'] = [$georgeTown, $tanjung];
        $visitStudio['is_active'] = (bool) ($visitStudio['is_active'] ?? true);
        if (! isset($visitStudio['heading']) || ! is_array($visitStudio['heading'])) {
            $visitStudio['heading'] = ['label' => '', 'title' => 'Visit Our Studio', 'align' => 'left'];
        }

        foreach ([
            'studio_name', 'address', 'google_maps_url', 'waze_url',
            'whatsapp_phone', 'whatsapp_message', 'whatsapp_url',
            'google_maps_label', 'waze_label', 'whatsapp_label',
            'opening_hours_heading', 'opening_hours', 'bottom_label', 'column_order', 'tab_label',
        ] as $legacyKey) {
            unset($visitStudio[$legacyKey]);
        }

        return $visitStudio;
    }

    /**
     * @param  array<string, mixed>  $canonical
     * @param  array<string, mixed>|null  $existing
     * @return array<string, mixed>
     */
    private function mergePreservedFields(array $canonical, ?array $existing): array
    {
        if ($existing === null) {
            return $canonical;
        }

        if (trim((string) ($existing['whatsapp_message'] ?? '')) !== '') {
            $canonical['whatsapp_message'] = trim((string) $existing['whatsapp_message']);
        }
        if (($existing['column_order'] ?? '') === 'hours_left') {
            $canonical['column_order'] = 'hours_left';
        }

        return $canonical;
    }

    /**
     * @param  list<array<string, mixed>>  $locations
     * @param  list<string>  $needles
     * @return array<string, mixed>|null
     */
    private function findLocation(array $locations, array $needles): ?array
    {
        foreach ($locations as $location) {
            if ($this->matchesAny($location, $needles)) {
                return $location;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $location
     * @param  list<string>  $needles
     */
    private function matchesAny(array $location, array $needles): bool
    {
        $haystack = strtolower(
            trim((string) ($location['tab_label'] ?? '')).' '.
            trim((string) ($location['studio_name'] ?? '')).' '.
            trim((string) ($location['address'] ?? ''))
        );

        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $visitStudio
     * @return list<array<string, mixed>>
     */
    private function resolveLocations(array $visitStudio): array
    {
        $raw = $visitStudio['locations'] ?? null;
        if (is_array($raw) && $raw !== []) {
            $out = [];
            foreach (array_values($raw) as $item) {
                if (is_array($item)) {
                    $out[] = $item;
                }
            }

            return $out;
        }

        $hasLegacy = trim((string) ($visitStudio['studio_name'] ?? '')) !== ''
            || trim((string) ($visitStudio['address'] ?? '')) !== ''
            || trim((string) ($visitStudio['whatsapp_phone'] ?? '')) !== ''
            || trim((string) ($visitStudio['google_maps_url'] ?? '')) !== '';

        if (! $hasLegacy) {
            return [];
        }

        return [[
            'tab_label' => trim((string) ($visitStudio['tab_label'] ?? '')) ?: 'Location 1',
            'studio_name' => trim((string) ($visitStudio['studio_name'] ?? '')),
            'address' => trim((string) ($visitStudio['address'] ?? '')),
            'google_maps_url' => trim((string) ($visitStudio['google_maps_url'] ?? '')),
            'waze_url' => trim((string) ($visitStudio['waze_url'] ?? '')),
            'whatsapp_phone' => trim((string) ($visitStudio['whatsapp_phone'] ?? '')),
            'whatsapp_message' => trim((string) ($visitStudio['whatsapp_message'] ?? '')),
            'google_maps_label' => trim((string) ($visitStudio['google_maps_label'] ?? '')) ?: 'GOOGLE MAPS',
            'waze_label' => trim((string) ($visitStudio['waze_label'] ?? '')) ?: 'OPEN WAZE',
            'whatsapp_label' => trim((string) ($visitStudio['whatsapp_label'] ?? '')) ?: 'MESSAGE US ON WHATSAPP',
            'opening_hours_heading' => trim((string) ($visitStudio['opening_hours_heading'] ?? '')) ?: 'Opening Hours',
            'opening_hours' => is_array($visitStudio['opening_hours'] ?? null) ? $visitStudio['opening_hours'] : [],
            'bottom_label' => trim((string) ($visitStudio['bottom_label'] ?? '')),
            'column_order' => ($visitStudio['column_order'] ?? 'contact_left') === 'hours_left' ? 'hours_left' : 'contact_left',
        ]];
    }
}
