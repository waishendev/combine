<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ServicesPageController extends Controller
{
    public function index()
    {
        $pages = ServicesPage::with('menuItem')
            ->orderBy('title')
            ->get();

        return $this->respond($pages);
    }

    public function show(ServicesMenuItem $servicesMenuItem)
    {
        $page = ServicesPage::with('menuItem')
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
            'hero_slides.*.src' => ['required_with:hero_slides', 'string', 'max:255'],
            'hero_slides.*.mobileSrc' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.alt' => ['required_with:hero_slides', 'string', 'max:255'],
            'hero_slides.*.title' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.subtitle' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.description' => ['nullable', 'string'],
            'hero_slides.*.buttonLabel' => ['nullable', 'string', 'max:255'],
            'hero_slides.*.buttonHref' => ['nullable', 'string', 'max:255'],
            'sections' => ['required', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $page = ServicesPage::updateOrCreate(
            ['services_menu_item_id' => $servicesMenuItem->id],
            [
                'title' => $validated['title'],
                'slug' => $validated['slug'],
                'subtitle' => $validated['subtitle'] ?? null,
                'hero_slides' => $validated['hero_slides'] ?? [],
                'sections' => $this->mergeWithDefaults($validated['sections']),
                'is_active' => $validated['is_active'] ?? true,
            ]
        );

        // Keep menu slug and name aligned when the page slug/title changes.
        $servicesMenuItem->update([
            'name' => $validated['title'],
            'slug' => $validated['slug'],
            'is_active' => $validated['is_active'] ?? $servicesMenuItem->is_active,
        ]);

        $page->load('menuItem');

        return $this->respond($page, __('Services page saved successfully.'));
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
