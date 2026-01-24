<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;
use Illuminate\Support\Facades\Storage;

class PublicServicesController extends Controller
{
    public function menu()
    {
        $items = ServicesMenuItem::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get([
                'id',
                'name as title',
                'slug',
                'sort_order',
            ]);

        return $this->respond($items);
    }

    public function show(string $slug)
    {
        $page = ServicesPage::query()
            ->with(['menuItem:id,name,slug,is_active', 'slides'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        if (! $page->menuItem?->is_active) {
            abort(404);
        }

        $heroSlides = array_map(function (array $slide) {
            return array_merge($slide, [
                'src' => $this->resolvePublicUrl($slide['src'] ?? null),
                'mobileSrc' => $this->resolvePublicUrl($slide['mobileSrc'] ?? null),
            ]);
        }, $page->hero_slides ?? []);

        return $this->respond([
            'id' => $page->id,
            'menu_item_id' => $page->services_menu_item_id,
            'title' => $page->title,
            'slug' => $page->slug,
            'subtitle' => $page->subtitle,
            'hero_slides' => $heroSlides,
            'sections' => $page->sections,
        ]);
    }

    private function resolvePublicUrl(?string $path): string
    {
        if (! $path) {
            return '';
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        $normalizedPath = ltrim($path, '/');

        return Storage::disk('public')->url($normalizedPath);
    }
}
