<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLandingPage;
use Illuminate\Database\Seeder;

/**
 * Production-safe one-off: clean booking landing homepage placeholders / typos.
 *
 * - Hero mission line: fix Wired/Craetive/Unxepceted/Unqiue → Weird/Creative/Unexpected/Unique
 * - Shop Environment: clear leftover "Test Description" body text
 *
 * php artisan db:seed --class=FixBookingLandingPageContentSeeder
 */
class FixBookingLandingPageContentSeeder extends Seeder
{
    public function run(): void
    {
        $page = BookingLandingPage::query()->where('slug', 'home')->first();
        if (! $page) {
            $this->command?->warn('booking_landing_pages slug=home not found. Nothing to do.');

            return;
        }

        $sections = is_array($page->sections) ? $page->sections : [];
        $changed = [];

        $heroSubtitle = (string) data_get($sections, 'hero.subtitle', '');
        if ($heroSubtitle !== '') {
            $fixedHero = str_replace(
                [
                    'Wired, Craetive, Unxepceted and Unqiue',
                    'Wired, Craetive, Unxepceted and Unique',
                    'Weird, Craetive, Unxepceted and Unqiue',
                ],
                'Weird, Creative, Unexpected and Unique',
                $heroSubtitle,
            );
            // Also fix individual common misspellings if the full phrase was edited.
            $fixedHero = str_replace(
                ['Craetive', 'Unxepceted', 'Unqiue', 'Wired'],
                ['Creative', 'Unexpected', 'Unique', 'Weird'],
                $fixedHero,
            );

            if ($fixedHero !== $heroSubtitle) {
                data_set($sections, 'hero.subtitle', $fixedHero);
                $changed[] = 'hero.subtitle typos';
            }
        }

        $artistSections = data_get($sections, 'our_artists_sections', []);
        if (is_array($artistSections)) {
            $cleared = 0;
            foreach ($artistSections as $sectionIndex => $section) {
                $items = data_get($section, 'items', []);
                if (! is_array($items)) {
                    continue;
                }
                foreach ($items as $itemIndex => $item) {
                    $text = trim((string) data_get($item, 'text', ''));
                    if (strcasecmp($text, 'Test Description') === 0 || strcasecmp($text, 'DUMMY TEXT') === 0) {
                        data_set($sections, "our_artists_sections.{$sectionIndex}.items.{$itemIndex}.text", null);
                        $cleared++;
                    }
                }
            }
            if ($cleared > 0) {
                $changed[] = "cleared {$cleared} placeholder artist/shop text(s)";
            }
        }

        if ($changed === []) {
            $this->command?->info('No booking landing content changes needed.');

            return;
        }

        $page->sections = $sections;
        $page->save();

        foreach ($changed as $line) {
            $this->command?->info('Updated: '.$line);
        }
        $this->command?->info('booking_landing_pages#'.(int) $page->id.' saved.');
    }
}
