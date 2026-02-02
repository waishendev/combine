<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;
use App\Models\Ecommerce\ShopMenuItem;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ServicesPageController extends Controller
{
    public function index()
    {
        $pages = ServicesPage::with(['menuItem', 'slides'])
            ->orderBy('title')
            ->get();

        return $this->respond($pages);
    }

    public function show(ServicesMenuItem $servicesMenuItem)
    {
        $page = ServicesPage::with(['menuItem', 'slides'])
            ->where('services_menu_item_id', $servicesMenuItem->id)
            ->first();

        if (! $page) {
            return $this->respond([
                'menu_item_id' => $servicesMenuItem->id,
                'menu_slug' => $servicesMenuItem->slug,
                'title' => $servicesMenuItem->name,
                'slug' => $servicesMenuItem->slug,
                'subtitle' => null,
                'hero_slides' => [],
                'sections' => $this->defaultSections(),
                'is_active' => $servicesMenuItem->is_active,
            ]);
        }

        $page->sections = $this->resolveSectionUrls($page->sections ?? []);

        return $this->respond($page);
    }

    public function previewConfig()
    {
        $shopMenu = ShopMenuItem::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get([
                'id',
                'name as label',
                'slug',
                'sort_order',
            ]);

        $servicesMenu = ServicesMenuItem::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get([
                'id',
                'name as label',
                'slug',
                'sort_order',
            ]);

        $branding = SettingService::get('branding', [
            'shop_logo_path' => null,
            'crm_logo_path' => null,
            'shop_favicon_path' => null,
            'crm_favicon_path' => null,
        ]);

        $footer = SettingService::get('footer', $this->defaultFooterSetting());

        return $this->respond([
            'header' => [
                'shop_menu' => $shopMenu,
                'services_menu' => $servicesMenu,
            ],
            'header_logo' => $this->resolveLogoUrl($branding['shop_logo_path'] ?? null),
            'footer' => $footer,
        ]);
    }

    public function upsert(Request $request, ServicesMenuItem $servicesMenuItem)
    {
        $existingPageId = ServicesPage::where('services_menu_item_id', $servicesMenuItem->id)->value('id');

        if (is_string($request->input('sections'))) {
            $decodedSections = json_decode($request->input('sections'), true);
            if (is_array($decodedSections)) {
                $request->merge(['sections' => $decodedSections]);
            }
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'slug' => [
                'required',
                'string',
                'max:150',
                Rule::unique('services_pages', 'slug')->ignore($existingPageId),
            ],
            'subtitle' => ['nullable', 'string', 'max:500'],
            'hero_slides' => ['nullable', 'array'],
            'hero_slides.*.sort_order' => ['nullable', 'integer', 'min:1'],
            'hero_slides.*.src' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.mobileSrc' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'hero_slides.*.mobile_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'hero_slides.*.title' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.subtitle' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.description' => ['nullable', 'string'],
            'hero_slides.*.buttonLabel' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.buttonHref' => ['nullable', 'string', 'max:255'],
            'sections' => ['required', 'array'],
            'gallery_images' => ['nullable', 'array', 'max:16'],
            'gallery_images.*' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $normalizedSlides = $this->normalizeSlides($request, $validated['hero_slides'] ?? []);
        $normalizedSections = $this->mergeWithDefaults(
            $this->normalizeGallerySection($request, $validated['sections'])
        );

        $existingPage = ServicesPage::with('slides')
            ->where('services_menu_item_id', $servicesMenuItem->id)
            ->first();
        $existingGalleryPaths = $existingPage ? $this->extractGalleryPaths($existingPage->sections ?? []) : [];

        $page = DB::transaction(function () use ($servicesMenuItem, $validated, $normalizedSlides, $normalizedSections, $existingPage, $existingGalleryPaths) {
            if ($existingPage) {
                $this->deleteSlideFiles($existingPage->slides);
                $this->deleteGalleryFiles($existingGalleryPaths, $normalizedSections);
            }

            $page = ServicesPage::updateOrCreate(
                ['services_menu_item_id' => $servicesMenuItem->id],
                [
                    'title' => $validated['title'],
                    'slug' => $validated['slug'],
                    'subtitle' => $validated['subtitle'] ?? null,
                    'hero_slides' => $normalizedSlides,
                    'sections' => $normalizedSections,
                    'is_active' => $validated['is_active'] ?? true,
                ]
            );

            $page->slides()->delete();

            if (! empty($normalizedSlides)) {
                $page->slides()->createMany(array_map(function (array $slide) {
                    return [
                        'sort_order' => $slide['sort_order'],
                        'image_path' => $slide['src'],
                        'mobile_image_path' => $slide['mobileSrc'] ?: null,
                        'title' => $slide['title'] ?: null,
                        'description' => $slide['description'] ?: null,
                        'button_label' => $slide['buttonLabel'] ?: null,
                        'button_link' => $slide['buttonHref'] ?: null,
                    ];
                }, $normalizedSlides));
            }

            // Keep menu slug and name aligned when the page slug/title changes.
            $servicesMenuItem->update([
                'name' => $validated['title'],
                'slug' => $validated['slug'],
                'is_active' => $validated['is_active'] ?? $servicesMenuItem->is_active,
            ]);

            return $page;
        });

        $page->load(['menuItem', 'slides']);
        $page->sections = $this->resolveSectionUrls($page->sections ?? []);

        return $this->respond($page, __('Services page saved successfully.'));
    }

    public function destroy(ServicesMenuItem $servicesMenuItem)
    {
        $page = ServicesPage::with('slides')
            ->where('services_menu_item_id', $servicesMenuItem->id)
            ->first();

        if (! $page) {
            return $this->respond(null, __('Services page not found.'), false, 404);
        }

        $this->deleteSlideFiles($page->slides);
        $page->slides()->delete();
        $page->delete();

        return $this->respond(null, __('Services page deleted successfully.'));
    }

    private function normalizeGallerySection(Request $request, array $sections): array
    {
        if (! isset($sections['gallery']) || ! is_array($sections['gallery'])) {
            return $sections;
        }

        $gallery = $sections['gallery'];
        $items = $gallery['items'] ?? [];
        $normalizedItems = [];

        if (is_array($items)) {
            foreach (array_values($items) as $index => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $src = $this->normalizeStoragePath((string) ($item['src'] ?? ''));
                if ($request->hasFile("gallery_images.$index")) {
                    $src = $this->storeGalleryImage($request->file("gallery_images.$index"));
                }

                if ($src === '') {
                    continue;
                }

                $normalizedItems[] = [
                    'src' => $src,
                    'alt' => (string) ($item['alt'] ?? ''),
                    'caption' => (string) ($item['caption'] ?? ''),
                    'captionAlign' => $this->normalizeAlignment($item['captionAlign'] ?? 'center'),
                ];

                if (count($normalizedItems) >= 16) {
                    break;
                }
            }
        }

        $gallery['items'] = $normalizedItems;
        if (isset($gallery['heading']['align'])) {
            $gallery['heading']['align'] = $this->normalizeAlignment($gallery['heading']['align']);
        }
        if (isset($gallery['footerAlign'])) {
            $gallery['footerAlign'] = $this->normalizeAlignment($gallery['footerAlign']);
        }
        if (isset($gallery['layout'])) {
            $gallery['layout'] = $this->normalizeGalleryLayout($gallery['layout']);
        }
        $sections['gallery'] = $gallery;

        return $sections;
    }

    private function resolveLogoUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        $normalizedPath = ltrim($path, '/');
        if (! $normalizedPath) {
            return null;
        }

        return Storage::disk('public')->url($normalizedPath);
    }

    private function defaultFooterSetting(): array
    {
        return [
            'enabled' => true,
            'about_text' => null,
            'contact' => [
                'whatsapp' => null,
                'email' => null,
                'address' => null,
            ],
            'social' => [
                'instagram' =>'',
                'facebook' => '',
                'tiktok' => '',
            ],
            'links' => [
                'shipping_policy' => '/shipping-policy',
                'return_refund' => '/return-refund',
                'privacy' => '/privacy-policy',
            ],
        ];
    }

    private function normalizeSlides(Request $request, array $slides): array
    {
        $normalized = [];

        foreach (array_values($slides) as $index => $slide) {
            if (! is_array($slide)) {
                continue;
            }

            $description = trim((string) ($slide['description'] ?? $slide['subtitle'] ?? ''));
            $imagePath = $this->normalizeStoragePath((string) ($slide['src'] ?? ''));
            $mobileImagePath = $this->normalizeStoragePath((string) ($slide['mobileSrc'] ?? ''));

            if ($request->hasFile("hero_slides.$index.image_file")) {
                $imagePath = $this->storeSlideImage($request->file("hero_slides.$index.image_file"), false);
            }

            if ($request->hasFile("hero_slides.$index.mobile_image_file")) {
                $mobileImagePath = $this->storeSlideImage($request->file("hero_slides.$index.mobile_image_file"), true);
            }

            if ($imagePath === '') {
                continue;
            }

            $normalized[] = [
                'sort_order' => (int) ($slide['sort_order'] ?? $index + 1),
                'src' => $imagePath,
                'mobileSrc' => $mobileImagePath,
                'title' => (string) ($slide['title'] ?? ''),
                'description' => $description,
                'buttonLabel' => (string) ($slide['buttonLabel'] ?? ''),
                'buttonHref' => (string) ($slide['buttonHref'] ?? ''),
            ];
        }

        usort($normalized, fn (array $a, array $b) => $a['sort_order'] <=> $b['sort_order']);

        // Re-sequence to keep ordering predictable even if gaps/duplicates were sent.
        foreach ($normalized as $index => $slide) {
            $normalized[$index]['sort_order'] = $index + 1;
        }

        return $normalized;
    }

    private function storeSlideImage($file, bool $isMobile): string
    {
        $prefix = $isMobile ? 'services-slides/mobile_' : 'services-slides/';
        $filename = $prefix . uniqid() . '.' . $file->getClientOriginalExtension();

        return $file->storeAs('', $filename, 'public');
    }

    private function storeGalleryImage($file): string
    {
        $filename = 'services-gallery/' . uniqid() . '.' . $file->getClientOriginalExtension();

        return $file->storeAs('', $filename, 'public');
    }

    private function normalizeStoragePath(string $path): string
    {
        if ($path === '') {
            return '';
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            $parsed = parse_url($path);
            $path = is_array($parsed) ? ($parsed['path'] ?? '') : '';
        }

        $path = ltrim($path, '/');

        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        return $path;
    }

    private function resolveSectionUrls(array $sections): array
    {
        if (! isset($sections['gallery']['items']) || ! is_array($sections['gallery']['items'])) {
            return $sections;
        }

        $sections['gallery']['items'] = array_values(array_filter(array_map(function ($item) {
            if (! is_array($item)) {
                return null;
            }

            $src = $item['src'] ?? '';
            if (! $src) {
                return null;
            }

            if (! filter_var($src, FILTER_VALIDATE_URL)) {
                $normalizedPath = ltrim($src, '/');
                $item['src'] = Storage::disk('public')->url($normalizedPath);
            }

            return $item;
        }, $sections['gallery']['items'])));

        return $sections;
    }

    private function deleteSlideFiles($slides): void
    {
        foreach ($slides as $slide) {
            $this->deleteIfOwnedPath($slide->image_path);
            $this->deleteIfOwnedPath($slide->mobile_image_path);
        }
    }

    private function deleteGalleryFiles(array $existingPaths, array $sections): void
    {
        $nextPaths = $this->extractGalleryPaths($sections);
        $pathsToDelete = array_diff($existingPaths, $nextPaths);

        foreach ($pathsToDelete as $path) {
            $this->deleteIfOwnedPath($path);
        }
    }

    private function deleteIfOwnedPath(?string $path): void
    {
        if (
            ! $path ||
            (! str_starts_with($path, 'services-slides/') && ! str_starts_with($path, 'services-gallery/'))
        ) {
            return;
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    private function extractGalleryPaths(array $sections): array
    {
        $items = $sections['gallery']['items'] ?? [];
        if (! is_array($items)) {
            return [];
        }

        $paths = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $src = $item['src'] ?? null;
            if (is_string($src) && str_starts_with($src, 'services-gallery/')) {
                $paths[] = $src;
            }
        }

        return $paths;
    }

    private function normalizeAlignment($alignment): string
    {
        $value = is_string($alignment) ? strtolower($alignment) : 'left';
        if (in_array($value, ['left', 'center', 'right'], true)) {
            return $value;
        }
        return 'left';
    }

    private function normalizeGalleryLayout($layout): string
    {
        $value = is_string($layout) ? strtolower($layout) : 'fixed';
        if (in_array($value, ['auto', 'fixed'], true)) {
            return $value;
        }
        return 'fixed';
    }

    private function defaultSections(): array
    {
        return [
            'hero' => [
                'is_active' => true,
                'items' => [],
            ],
            'services' => [
                'is_active' => true,
                'items' => [],
                'heading' => [
                    'label' => 'Services',
                    'title' => "What's Included",
                    'align' => 'left',
                ],
            ],
            'gallery' => [
                'is_active' => true,
                'items' => [],
                'heading' => [
                    'label' => 'Service Menu',
                    'title' => 'Click to view services and pricing',
                    'align' => 'center',
                ],
                'footerText' => '',
                'footerAlign' => 'center',
                'layout' => 'fixed',
            ],
            'pricing' => [
                'is_active' => true,
                'items' => [],
                'heading' => [
                    'label' => 'Pricing',
                    'title' => 'Transparent rates',
                    'align' => 'left',
                ],
            ],
            'faqs' => [
                'is_active' => true,
                'items' => [],
                'heading' => [
                    'label' => 'FAQ',
                    'title' => 'You might be wondering',
                    'align' => 'left',
                ],
            ],
            'notes' => [
                'is_active' => true,
                'items' => [],
                'heading' => [
                    'label' => 'Notes',
                    'title' => 'Policy & care',
                    'align' => 'left',
                ],
            ],
        ];
    }

    private function mergeWithDefaults(array $sections): array
    {
        $defaults = $this->defaultSections();

        foreach ($defaults as $key => $value) {
            if (! array_key_exists($key, $sections) || ! is_array($sections[$key])) {
                $sections[$key] = $value;
                continue;
            }

            $sections[$key]['is_active'] = isset($sections[$key]['is_active'])
                ? (bool) $sections[$key]['is_active']
                : $value['is_active'];
            $sections[$key]['items'] = array_values($sections[$key]['items'] ?? []);

            foreach ($value as $sectionKey => $sectionValue) {
                if (in_array($sectionKey, ['is_active', 'items'], true)) {
                    continue;
                }

                if (is_array($sectionValue)) {
                    $sections[$key][$sectionKey] = array_merge(
                        $sectionValue,
                        is_array($sections[$key][$sectionKey] ?? null) ? $sections[$key][$sectionKey] : []
                    );
                } else {
                    $sections[$key][$sectionKey] = $sections[$key][$sectionKey] ?? $sectionValue;
                }
            }

            if (isset($sections[$key]['heading']['align'])) {
                $sections[$key]['heading']['align'] = $this->normalizeAlignment($sections[$key]['heading']['align']);
            }
            if ($key === 'gallery' && isset($sections[$key]['footerAlign'])) {
                $sections[$key]['footerAlign'] = $this->normalizeAlignment($sections[$key]['footerAlign']);
            }
            if ($key === 'gallery' && isset($sections[$key]['layout'])) {
                $sections[$key]['layout'] = $this->normalizeGalleryLayout($sections[$key]['layout']);
            }
        }

        return $sections;
    }
}
