<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLandingPage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LandingPageController extends Controller
{
    public function show()
    {
        $page = BookingLandingPage::where('slug', 'home')
            ->where('is_active', true)
            ->first();

        if (! $page) {
            return $this->respond([
                'id' => null,
                'slug' => 'home',
                'sections' => null,
            ]);
        }

        $sections = $this->resolveImageUrls($this->mergeWithDefaults($page->sections ?? []));

        return $this->respond([
            'id' => $page->id,
            'slug' => $page->slug,
            'sections' => $sections,
        ]);
    }

    public function adminShow()
    {
        $page = BookingLandingPage::where('slug', 'home')->first();

        if (! $page) {
            return $this->respond($this->defaultPage());
        }

        $sections = $this->resolveImageUrls($this->mergeWithDefaults($page->sections ?? []));

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

        $sections = $this->mergeWithDefaults($request->input('sections', []));
        $sections = $this->migrateLegacyMediaSections($sections);

        $this->extractPathsFromItems($sections, 'gallery');
        $this->extractPathsFromItems($sections, 'nail_academy');
        $this->extractPathsFromBlocks($sections, 'service_menus');
        $this->extractPathsFromBlocks($sections, 'our_artists_sections');
        unset($sections['service_menu'], $sections['our_artists']);

        $page = BookingLandingPage::updateOrCreate(
            ['slug' => 'home'],
            [
                'sections' => $sections,
                'is_active' => true,
            ]
        );

        $resolved = $this->resolveImageUrls($page->sections ?? []);

        return $this->respond([
            'id' => $page->id,
            'slug' => $page->slug,
            'sections' => $resolved,
        ]);
    }

    public function uploadImage(Request $request)
    {
        $request->validate([
            'image' => 'required|image|max:5120',
            'section' => 'required|string',
        ]);

        $path = $request->file('image')->store('booking-landing', 'public');

        return $this->respond([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
        ]);
    }

    private function defaultPage(): array
    {
        return [
            'id' => null,
            'slug' => 'home',
            'sections' => [
                'hero' => [
                    'is_active' => true,
                    'label' => 'Premium Salon Booking',
                    'title' => 'Beauty appointments, made effortless.',
                    'subtitle' => 'Discover signature services, reserve your slot instantly, and arrive confident with our trusted professional team.',
                    'cta_label' => 'Book Appointment',
                    'cta_link' => '/booking',
                    'decorations_enabled' => true,
                ],
                'gallery' => [
                    'is_active' => true,
                    'heading' => ['label' => 'GALLERY', 'title' => 'Click to view services and pricing', 'align' => 'center'],
                    'items' => [],
                ],
                'service_menus' => [
                    [
                        'is_active' => true,
                        'heading' => ['label' => 'Service Menu', 'title' => 'Click to view services and pricing', 'align' => 'center'],
                        'items' => [],
                    ],
                ],
                'our_artists_sections' => [
                    [
                        'is_active' => true,
                        'heading' => ['label' => 'Our Artists', 'title' => 'Meet our creative professionals', 'align' => 'center'],
                        'items' => [],
                    ],
                ],
                'nail_academy' => [
                    'is_active' => true,
                    'heading' => ['label' => 'EXCELLENCE IN JAPANESE NAIL ART EDUCATION', 'title' => 'Nail Academy', 'align' => 'center'],
                    'target_label' => '面向对象',
                    'curriculum_label' => '教学核心',
                    'items' => [],
                ],
                'faqs' => [
                    'is_active' => true,
                    'heading' => ['label' => 'FAQ', 'title' => 'You might be wondering', 'align' => 'left'],
                    'items' => [],
                ],
                'notes' => [
                    'is_active' => true,
                    'heading' => ['label' => 'Notes', 'title' => 'Policy & care', 'align' => 'left'],
                    'items' => [],
                ],
                'visit_studio' => [
                    'is_active' => true,
                    'heading' => ['label' => '', 'title' => 'Visit Our Studio', 'align' => 'left'],
                    'studio_name' => '',
                    'address' => '',
                    'google_maps_url' => '',
                    'waze_url' => '',
                    'whatsapp_phone' => '',
                    'whatsapp_message' => 'Hi! I would like to get in touch about your salon services.',
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
                ],
            ],
        ];
    }

    private function resolveImageUrls(array $sections): array
    {
        $sections = $this->migrateLegacyMediaSections($sections);
        $this->resolveUrlsFromItems($sections, 'gallery');
        $this->resolveUrlsFromItems($sections, 'nail_academy');
        $this->resolveUrlsFromBlocks($sections, 'service_menus');
        $this->resolveUrlsFromBlocks($sections, 'our_artists_sections');

        return $sections;
    }

    private function migrateLegacyMediaSections(array $sections): array
    {
        if (! isset($sections['service_menus']) || ! is_array($sections['service_menus']) || $sections['service_menus'] === []) {
            if (isset($sections['service_menu']) && is_array($sections['service_menu'])) {
                $sections['service_menus'] = [$sections['service_menu']];
            }
        }
        if (! isset($sections['our_artists_sections']) || ! is_array($sections['our_artists_sections']) || $sections['our_artists_sections'] === []) {
            if (isset($sections['our_artists']) && is_array($sections['our_artists'])) {
                $sections['our_artists_sections'] = [$sections['our_artists']];
            }
        }
        unset($sections['service_menu'], $sections['our_artists']);

        if (isset($sections['service_menus']) && is_array($sections['service_menus'])) {
            $sections['service_menus'] = array_values($sections['service_menus']);
        }
        if (isset($sections['our_artists_sections']) && is_array($sections['our_artists_sections'])) {
            $sections['our_artists_sections'] = array_values($sections['our_artists_sections']);
        }

        return $sections;
    }

    private function extractPathsFromItems(array &$sections, string $key): void
    {
        if (! isset($sections[$key]['items']) || ! is_array($sections[$key]['items'])) {
            return;
        }
        foreach ($sections[$key]['items'] as $idx => $item) {
            if (is_array($item) && isset($item['src'])) {
                $sections[$key]['items'][$idx]['src'] = $this->extractPath($item['src']);
            }
        }
    }

    private function extractPathsFromBlocks(array &$sections, string $key): void
    {
        if (! isset($sections[$key]) || ! is_array($sections[$key])) {
            return;
        }
        foreach ($sections[$key] as $blockIdx => $block) {
            if (! is_array($block) || ! isset($block['items']) || ! is_array($block['items'])) {
                continue;
            }
            foreach ($block['items'] as $idx => $item) {
                if (is_array($item) && isset($item['src'])) {
                    $sections[$key][$blockIdx]['items'][$idx]['src'] = $this->extractPath($item['src']);
                }
            }
        }
    }

    private function resolveUrlsFromItems(array &$sections, string $key): void
    {
        if (! isset($sections[$key]['items']) || ! is_array($sections[$key]['items'])) {
            return;
        }
        foreach ($sections[$key]['items'] as $idx => $item) {
            if (is_array($item) && ! empty($item['src'])) {
                $sections[$key]['items'][$idx]['src'] = $this->resolveUrl($item['src']);
            }
        }
    }

    private function resolveUrlsFromBlocks(array &$sections, string $key): void
    {
        if (! isset($sections[$key]) || ! is_array($sections[$key])) {
            return;
        }
        foreach ($sections[$key] as $blockIdx => $block) {
            if (! is_array($block) || ! isset($block['items']) || ! is_array($block['items'])) {
                continue;
            }
            foreach ($block['items'] as $idx => $item) {
                if (is_array($item) && ! empty($item['src'])) {
                    $sections[$key][$blockIdx]['items'][$idx]['src'] = $this->resolveUrl($item['src']);
                }
            }
        }
    }

    private function extractPath(?string $urlOrPath): string
    {
        if (! $urlOrPath) {
            return '';
        }

        if (filter_var($urlOrPath, FILTER_VALIDATE_URL)) {
            $parsed = parse_url($urlOrPath);
            if (is_array($parsed) && isset($parsed['path'])) {
                $path = $parsed['path'];
                if (str_starts_with($path, '/storage/')) {
                    return substr($path, strlen('/storage/'));
                }
                return ltrim($path, '/');
            }
        }

        $path = ltrim($urlOrPath, '/');
        if (str_starts_with($path, 'storage/')) {
            return substr($path, strlen('storage/'));
        }

        return $path;
    }

    private function resolveUrl(?string $path): string
    {
        if (! $path) {
            return '';
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        return Storage::disk('public')->url(ltrim($path, '/'));
    }

    private function mergeWithDefaults(array $sections): array
    {
        $sections = $this->migrateLegacyMediaSections($sections);
        $defaults = $this->defaultPage()['sections'];
        foreach ($defaults as $key => $value) {
            if ($key === 'service_menus' || $key === 'our_artists_sections') {
                if (! isset($sections[$key]) || ! is_array($sections[$key]) || $sections[$key] === []) {
                    $sections[$key] = $value;
                } else {
                    $sections[$key] = array_values($sections[$key]);
                }
                continue;
            }
            if (! isset($sections[$key]) || ! is_array($sections[$key])) {
                $sections[$key] = $value;
                continue;
            }
            $sections[$key] = array_merge($value, $sections[$key]);
            if (isset($value['heading']) && is_array($value['heading'])) {
                $sections[$key]['heading'] = array_merge($value['heading'], is_array($sections[$key]['heading'] ?? null) ? $sections[$key]['heading'] : []);
                $sections[$key]['heading']['align'] = $this->normalizeAlign($sections[$key]['heading']['align'] ?? $value['heading']['align']);
            }
            if (isset($value['items']) && is_array($value['items'])) {
                $sections[$key]['items'] = array_values(is_array($sections[$key]['items'] ?? null) ? $sections[$key]['items'] : []);
            }
            if ($key === 'visit_studio' && isset($sections[$key]['opening_hours']) && is_array($sections[$key]['opening_hours'])) {
                $sections[$key]['opening_hours'] = array_values($sections[$key]['opening_hours']);
            }
            if ($key === 'visit_studio') {
                $co = $sections[$key]['column_order'] ?? 'contact_left';
                $sections[$key]['column_order'] = $co === 'hours_left' ? 'hours_left' : 'contact_left';
            }
        }
        return $sections;
    }

    private function normalizeAlign(?string $align): string
    {
        return in_array($align, ['left', 'center', 'right'], true) ? $align : 'center';
    }
}
