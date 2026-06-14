<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\EcommerceLandingPage;
use Illuminate\Http\Request;

class LandingPageController extends Controller
{
    public function show()
    {
        $page = EcommerceLandingPage::where('slug', 'home')
            ->where('is_active', true)
            ->first();

        if (! $page) {
            return $this->respond([
                'id' => null,
                'slug' => 'home',
                'sections' => null,
            ]);
        }

        $sections = $this->normalizeSections($page->sections ?? []);

        return $this->respond([
            'id' => $page->id,
            'slug' => $page->slug,
            'sections' => $sections,
        ]);
    }

    public function adminShow()
    {
        $page = EcommerceLandingPage::where('slug', 'home')->first();

        if (! $page) {
            return $this->respond($this->defaultPage());
        }

        $sections = $this->normalizeSections($page->sections ?? []);

        return $this->respond([
            'id' => $page->id,
            'slug' => $page->slug,
            'sections' => $sections,
        ]);
    }

    public function update(Request $request)
    {
        $request->validate([
            'sections' => 'required|array',
        ]);

        $sections = $this->normalizeSections($request->input('sections', []));

        $page = EcommerceLandingPage::updateOrCreate(
            ['slug' => 'home'],
            [
                'sections' => $sections,
                'is_active' => true,
            ]
        );

        return $this->respond([
            'id' => $page->id,
            'slug' => $page->slug,
            'sections' => $this->normalizeSections($page->sections ?? []),
        ]);
    }

    private function defaultPage(): array
    {
        return [
            'id' => null,
            'slug' => 'home',
            'sections' => [
                'slider_intro' => $this->defaultSliderIntro(),
                'hero' => $this->defaultHero(),
                'visit_studio' => $this->defaultVisitStudio(),
            ],
        ];
    }

    private function defaultSliderIntro(): array
    {
        return [
            'is_active' => true,
            'headline' => 'Effortless silhouettes, luxe textures, everyday confidence.',
        ];
    }

    private function defaultHero(): array
    {
        return [
            'is_active' => true,
            'label' => '',
            'title' => '',
            'subtitle' => '',
            'title_2' => '',
            'subtitle_2' => '',
            'cta_label' => 'Shop Now',
            'cta_link' => '/shop',
        ];
    }

    private function defaultVisitStudio(): array
    {
        return [
            'is_active' => true,
            'heading' => ['label' => '', 'title' => 'Visit Our Studio', 'align' => 'left'],
            'studio_name' => '',
            'address' => '',
            'google_maps_url' => '',
            'waze_url' => '',
            'whatsapp_phone' => '',
            'whatsapp_message' => 'Hi! I would like to get in touch about your shop.',
            'google_maps_label' => 'GOOGLE MAPS',
            'waze_label' => 'OPEN WAZE',
            'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
            'opening_hours_heading' => 'Opening Hours',
            'opening_hours' => [
                ['day_range' => 'Monday — Friday', 'time_range' => '11:00 AM — 6:30 PM'],
                ['day_range' => 'Saturday — Sunday', 'time_range' => '9:00 AM — 4:30 PM'],
            ],
            'bottom_label' => '',
            'column_order' => 'contact_left',
        ];
    }

    private function normalizeSections(array $sections): array
    {
        return [
            'slider_intro' => $this->normalizeSliderIntro(is_array($sections['slider_intro'] ?? null) ? $sections['slider_intro'] : []),
            'hero' => $this->normalizeHero(is_array($sections['hero'] ?? null) ? $sections['hero'] : []),
            'visit_studio' => $this->normalizeVisitStudio(is_array($sections['visit_studio'] ?? null) ? $sections['visit_studio'] : []),
        ];
    }

    private function normalizeSliderIntro(array $sliderIntro): array
    {
        $defaults = $this->defaultSliderIntro();

        return [
            'is_active' => (bool) ($sliderIntro['is_active'] ?? $defaults['is_active']),
            'headline' => trim((string) ($sliderIntro['headline'] ?? $defaults['headline'])),
        ];
    }

    private function normalizeHero(array $hero): array
    {
        $defaults = $this->defaultHero();

        return [
            'is_active' => (bool) ($hero['is_active'] ?? $defaults['is_active']),
            'label' => trim((string) ($hero['label'] ?? $defaults['label'])),
            'title' => trim((string) ($hero['title'] ?? $defaults['title'])),
            'subtitle' => trim((string) ($hero['subtitle'] ?? $defaults['subtitle'])),
            'title_2' => trim((string) ($hero['title_2'] ?? $defaults['title_2'])),
            'subtitle_2' => trim((string) ($hero['subtitle_2'] ?? $defaults['subtitle_2'])),
            'cta_label' => trim((string) ($hero['cta_label'] ?? $defaults['cta_label'])),
            'cta_link' => trim((string) ($hero['cta_link'] ?? $defaults['cta_link'])),
        ];
    }

    private function normalizeVisitStudio(array $visitStudio): array
    {
        $defaults = $this->defaultVisitStudio();

        $headingDefaults = $defaults['heading'];
        $heading = is_array($visitStudio['heading'] ?? null)
            ? array_merge($headingDefaults, $visitStudio['heading'])
            : $headingDefaults;
        $heading['align'] = in_array($heading['align'] ?? 'left', ['left', 'center', 'right'], true)
            ? $heading['align']
            : 'left';

        $openingHours = [];
        if (isset($visitStudio['opening_hours']) && is_array($visitStudio['opening_hours'])) {
            foreach ($visitStudio['opening_hours'] as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $openingHours[] = [
                    'day_range' => trim((string) ($row['day_range'] ?? '')),
                    'time_range' => trim((string) ($row['time_range'] ?? '')),
                ];
            }
        }

        $legacyUrl = trim((string) ($visitStudio['whatsapp_url'] ?? ''));
        $phone = trim((string) ($visitStudio['whatsapp_phone'] ?? ''));
        $message = trim((string) ($visitStudio['whatsapp_message'] ?? ''));

        if ($phone === '' && $legacyUrl !== '') {
            $phone = $this->extractPhoneFromWhatsAppUrl($legacyUrl);
        }
        if ($message === '') {
            $fromUrl = $this->extractMessageFromWhatsAppUrl($legacyUrl);
            $message = $fromUrl !== '' ? $fromUrl : $defaults['whatsapp_message'];
        }

        $columnOrder = ($visitStudio['column_order'] ?? 'contact_left') === 'hours_left'
            ? 'hours_left'
            : 'contact_left';

        return [
            'is_active' => (bool) ($visitStudio['is_active'] ?? $defaults['is_active']),
            'heading' => $heading,
            'studio_name' => trim((string) ($visitStudio['studio_name'] ?? '')),
            'address' => trim((string) ($visitStudio['address'] ?? '')),
            'google_maps_url' => trim((string) ($visitStudio['google_maps_url'] ?? '')),
            'waze_url' => trim((string) ($visitStudio['waze_url'] ?? '')),
            'whatsapp_phone' => $phone,
            'whatsapp_message' => $message,
            'google_maps_label' => trim((string) ($visitStudio['google_maps_label'] ?? $defaults['google_maps_label'])),
            'waze_label' => trim((string) ($visitStudio['waze_label'] ?? $defaults['waze_label'])),
            'whatsapp_label' => trim((string) ($visitStudio['whatsapp_label'] ?? $defaults['whatsapp_label'])),
            'opening_hours_heading' => trim((string) ($visitStudio['opening_hours_heading'] ?? $defaults['opening_hours_heading'])),
            'opening_hours' => array_values($openingHours),
            'bottom_label' => trim((string) ($visitStudio['bottom_label'] ?? '')),
            'column_order' => $columnOrder,
        ];
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
