<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLandingPage;
use Illuminate\Database\Seeder;

/**
 * Safe to run on live/staging without migrate:fresh.
 *
 *   php artisan db:seed --class=BookingLandingPageVisitStudioWhatsAppSeeder
 *
 * NON-DESTRUCTIVE: reads the existing landing page row and only patches structure.
 * It does NOT replace headings, images, items, or add extra Service Menu / Our Artists blocks.
 *
 * Migrates:
 * - visit_studio.whatsapp_url → whatsapp_phone + whatsapp_message (only when those fields are empty)
 * - sections.service_menu → sections.service_menus[] (wraps the exact same block, no content change)
 * - sections.our_artists → sections.our_artists_sections[] (wraps the exact same block, no content change)
 */
class BookingLandingPageVisitStudioWhatsAppSeeder extends Seeder
{
    private const DEFAULT_MESSAGE = 'Hi! I would like to get in touch about your salon services.';

    public function run(): void
    {
        $page = BookingLandingPage::where('slug', 'home')->first();

        if (! $page) {
            $this->command?->warn('Booking landing page (slug=home) not found. Skipping.');

            return;
        }

        $sections = is_array($page->sections) ? $page->sections : [];
        $changed = false;

        if ($this->migrateVisitStudioWhatsApp($sections)) {
            $changed = true;
        }

        if ($this->migrateLegacyMediaSections($sections)) {
            $changed = true;
        }

        if (! $changed) {
            $this->command?->info('Booking landing page (slug=home) already up to date. No changes made.');

            return;
        }

        $page->sections = $sections;
        $page->save();

        $this->command?->info('Updated booking landing page (slug=home): WhatsApp fields and multi-section media blocks.');
    }

    private function migrateVisitStudioWhatsApp(array &$sections): bool
    {
        $visitStudio = is_array($sections['visit_studio'] ?? null) ? $sections['visit_studio'] : [];
        $before = json_encode($visitStudio);

        $legacyUrl = trim((string) ($visitStudio['whatsapp_url'] ?? ''));
        $phone = trim((string) ($visitStudio['whatsapp_phone'] ?? ''));
        $message = trim((string) ($visitStudio['whatsapp_message'] ?? ''));

        if ($phone === '' && $legacyUrl !== '') {
            $phone = $this->extractPhoneFromWhatsAppUrl($legacyUrl);
        }

        // Only fill message when migrating from legacy whatsapp_url — never overwrite an existing message.
        if ($message === '' && $legacyUrl !== '') {
            $fromUrl = $this->extractMessageFromWhatsAppUrl($legacyUrl);
            $message = $fromUrl !== '' ? $fromUrl : self::DEFAULT_MESSAGE;
        }

        $visitStudio['whatsapp_phone'] = $phone;
        $visitStudio['whatsapp_message'] = $message;
        unset($visitStudio['whatsapp_url']);

        $sections['visit_studio'] = $visitStudio;

        return json_encode($visitStudio) !== $before;
    }

    /**
     * Wrap legacy single blocks into arrays. Existing CRM content is preserved byte-for-byte.
     * Skips entirely when service_menus / our_artists_sections already exist.
     */
    private function migrateLegacyMediaSections(array &$sections): bool
    {
        $changed = false;

        $hasServiceMenus = isset($sections['service_menus']) && is_array($sections['service_menus']) && $sections['service_menus'] !== [];
        $hasArtistSections = isset($sections['our_artists_sections']) && is_array($sections['our_artists_sections']) && $sections['our_artists_sections'] !== [];

        if (! $hasServiceMenus && isset($sections['service_menu']) && is_array($sections['service_menu'])) {
            // Wrap only — same heading, items, images as before.
            $sections['service_menus'] = [$sections['service_menu']];
            $changed = true;
        }

        if (! $hasArtistSections && isset($sections['our_artists']) && is_array($sections['our_artists'])) {
            // Wrap only — same heading, items, images as before.
            $sections['our_artists_sections'] = [$sections['our_artists']];
            $changed = true;
        }

        // Drop old keys only; never touch hero, gallery, nail_academy, faqs, notes, visit_studio body.
        if (isset($sections['service_menu'])) {
            unset($sections['service_menu']);
            $changed = true;
        }

        if (isset($sections['our_artists'])) {
            unset($sections['our_artists']);
            $changed = true;
        }

        if (isset($sections['service_menus']) && is_array($sections['service_menus'])) {
            $reindexed = array_values($sections['service_menus']);
            if ($reindexed !== $sections['service_menus']) {
                $sections['service_menus'] = $reindexed;
                $changed = true;
            }
        }

        if (isset($sections['our_artists_sections']) && is_array($sections['our_artists_sections'])) {
            $reindexed = array_values($sections['our_artists_sections']);
            if ($reindexed !== $sections['our_artists_sections']) {
                $sections['our_artists_sections'] = $reindexed;
                $changed = true;
            }
        }

        return $changed;
    }

    private function extractPhoneFromWhatsAppUrl(string $url): string
    {
        if (preg_match('#wa\.me/(\d+)#i', $url, $matches)) {
            return $matches[1];
        }

        if (preg_match('#[?&]phone=(\d+)#i', $url, $matches)) {
            return $matches[1];
        }

        if (preg_match('/^[\d+\s\-()]+$/', $url)) {
            return preg_replace('/[^\d]/', '', $url) ?? '';
        }

        return '';
    }

    private function extractMessageFromWhatsAppUrl(string $url): string
    {
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['query'])) {
            return '';
        }

        parse_str($parts['query'], $query);
        $text = $query['text'] ?? '';

        return is_string($text) ? trim(rawurldecode($text)) : '';
    }
}
