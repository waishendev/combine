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
            return $this->respond($this->defaultPage());
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

        $sectionKeys = ['hero', 'gallery', 'service_menu', 'our_artists', 'faqs', 'notes'];
        foreach ($sectionKeys as $key) {
            if (isset($sections[$key]['items']) && is_array($sections[$key]['items'])) {
                foreach ($sections[$key]['items'] as $idx => $item) {
                    if (is_array($item) && isset($item['src'])) {
                        $sections[$key]['items'][$idx]['src'] = $this->extractPath($item['src']);
                    }
                }
            }
        }

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
                ],
                'gallery' => [
                    'is_active' => true,
                    'heading' => ['label' => 'GALLERY', 'title' => 'Click to view services and pricing', 'align' => 'center'],
                    'items' => [],
                ],
                'service_menu' => [
                    'is_active' => true,
                    'heading' => ['label' => 'Service Menu', 'title' => 'Click to view services and pricing', 'align' => 'center'],
                    'items' => [],
                ],
                'our_artists' => [
                    'is_active' => true,
                    'heading' => ['label' => 'Our Artists', 'title' => 'Meet our creative professionals', 'align' => 'center'],
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
            ],
        ];
    }

    private function resolveImageUrls(array $sections): array
    {
        $sectionKeys = ['gallery', 'service_menu', 'our_artists'];
        foreach ($sectionKeys as $key) {
            if (isset($sections[$key]['items']) && is_array($sections[$key]['items'])) {
                foreach ($sections[$key]['items'] as $idx => $item) {
                    if (is_array($item) && ! empty($item['src'])) {
                        $sections[$key]['items'][$idx]['src'] = $this->resolveUrl($item['src']);
                    }
                }
            }
        }

        return $sections;
    }

    private function extractPath(?string $urlOrPath): ?string
    {
        if (! $urlOrPath) {
            return null;
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
        $defaults = $this->defaultPage()['sections'];
        foreach ($defaults as $key => $value) {
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
        }
        return $sections;
    }

    private function normalizeAlign(?string $align): string
    {
        return in_array($align, ['left', 'center', 'right'], true) ? $align : 'center';
    }
}
