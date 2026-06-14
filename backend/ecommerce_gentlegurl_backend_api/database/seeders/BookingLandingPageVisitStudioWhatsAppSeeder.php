<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLandingPage;
use Illuminate\Database\Seeder;

/**
 * Safe to run on live/staging without migrate:fresh.
 *
 *   php artisan db:seed --class=BookingLandingPageVisitStudioWhatsAppSeeder
 *
 * Migrates visit_studio.whatsapp_url → whatsapp_phone + whatsapp_message.
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
        $visitStudio = is_array($sections['visit_studio'] ?? null) ? $sections['visit_studio'] : [];

        $legacyUrl = trim((string) ($visitStudio['whatsapp_url'] ?? ''));
        $phone = trim((string) ($visitStudio['whatsapp_phone'] ?? ''));
        $message = trim((string) ($visitStudio['whatsapp_message'] ?? ''));

        if ($phone === '' && $legacyUrl !== '') {
            $phone = $this->extractPhoneFromWhatsAppUrl($legacyUrl);
        }

        if ($message === '') {
            $fromUrl = $this->extractMessageFromWhatsAppUrl($legacyUrl);
            $message = $fromUrl !== '' ? $fromUrl : self::DEFAULT_MESSAGE;
        }

        $visitStudio['whatsapp_phone'] = $phone;
        $visitStudio['whatsapp_message'] = $message;
        unset($visitStudio['whatsapp_url']);

        $sections['visit_studio'] = $visitStudio;
        $page->sections = $sections;
        $page->save();

        $this->command?->info('Updated visit_studio WhatsApp fields on booking landing page (slug=home).');
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
