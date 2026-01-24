<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;
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

        return $this->respond($page);
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
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $normalizedSlides = $this->normalizeSlides($request, $validated['hero_slides'] ?? []);

        $page = DB::transaction(function () use ($servicesMenuItem, $validated, $normalizedSlides) {
            $page = ServicesPage::with('slides')
                ->where('services_menu_item_id', $servicesMenuItem->id)
                ->first();

            if ($page) {
                $this->deleteSlideFiles($page->slides);
            }

            $page = ServicesPage::updateOrCreate(
                ['services_menu_item_id' => $servicesMenuItem->id],
                [
                    'title' => $validated['title'],
                    'slug' => $validated['slug'],
                    'subtitle' => $validated['subtitle'] ?? null,
                    'hero_slides' => $normalizedSlides,
                    'sections' => $this->mergeWithDefaults($validated['sections']),
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

        return $this->respond($page, __('Services page saved successfully.'));
    }

    private function normalizeSlides(Request $request, array $slides): array
    {
        $normalized = [];

        foreach (array_values($slides) as $index => $slide) {
            if (! is_array($slide)) {
                continue;
            }

            $description = trim((string) ($slide['description'] ?? $slide['subtitle'] ?? ''));
            $imagePath = (string) ($slide['src'] ?? '');
            $mobileImagePath = (string) ($slide['mobileSrc'] ?? '');

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

    private function deleteSlideFiles($slides): void
    {
        foreach ($slides as $slide) {
            $this->deleteIfOwnedPath($slide->image_path);
            $this->deleteIfOwnedPath($slide->mobile_image_path);
        }
    }

    private function deleteIfOwnedPath(?string $path): void
    {
        if (! $path || ! str_starts_with($path, 'services-slides/')) {
            return;
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    private function defaultSections(): array
    {
        return [
            'services' => [
                'is_active' => true,
                'items' => [],
            ],
            'pricing' => [
                'is_active' => true,
                'items' => [],
            ],
            'faqs' => [
                'is_active' => true,
                'items' => [],
            ],
            'notes' => [
                'is_active' => true,
                'items' => [],
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
        }

        return $sections;
    }
}
