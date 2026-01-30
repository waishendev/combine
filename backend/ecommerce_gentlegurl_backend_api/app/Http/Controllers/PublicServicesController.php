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
            // Extract path from URL if it's a full URL, to ensure consistent URL generation
            $srcPath = $this->extractPathFromUrl($slide['src'] ?? null);
            $mobileSrcPath = $this->extractPathFromUrl($slide['mobileSrc'] ?? null);
            
            return array_merge($slide, [
                'src' => $this->resolvePublicUrl($srcPath),
                'mobileSrc' => $this->resolvePublicUrl($mobileSrcPath),
            ]);
        }, $page->hero_slides ?? []);

        $sections = $page->sections ?? [];
        if (isset($sections['gallery']['items']) && is_array($sections['gallery']['items'])) {
            $sections['gallery']['items'] = array_values(array_filter(array_map(function ($item) {
                if (! is_array($item)) {
                    return null;
                }
                // Extract path from URL if it's a full URL, to ensure consistent URL generation
                $srcPath = $this->extractPathFromUrl($item['src'] ?? null);
                $item['src'] = $this->resolvePublicUrl($srcPath);
                if ($item['src'] === '') {
                    return null;
                }
                return $item;
            }, $sections['gallery']['items'])));
        }

        return $this->respond([
            'id' => $page->id,
            'menu_item_id' => $page->services_menu_item_id,
            'title' => $page->title,
            'slug' => $page->slug,
            'subtitle' => $page->subtitle,
            'hero_slides' => $heroSlides,
            'sections' => $sections,
        ]);
    }

    private function extractPathFromUrl(?string $urlOrPath): ?string
    {
        if (! $urlOrPath) {
            return null;
        }

        // If it's a full URL, extract the path part
        if (filter_var($urlOrPath, FILTER_VALIDATE_URL)) {
            $parsed = parse_url($urlOrPath);
            if (is_array($parsed) && isset($parsed['path'])) {
                $path = $parsed['path'];
                // Remove '/storage' prefix if present
                if (str_starts_with($path, '/storage/')) {
                    return substr($path, strlen('/storage/'));
                }
                // Remove leading slash
                return ltrim($path, '/');
            }
        }

        // If it's already a path, normalize it
        $path = ltrim($urlOrPath, '/');
        if (str_starts_with($path, 'storage/')) {
            return substr($path, strlen('storage/'));
        }

        return $path;
    }

    private function resolvePublicUrl(?string $path): string
    {
        if (! $path) {
            return '';
        }

        $normalizedPath = ltrim($path, '/');

        return Storage::disk('public')->url($normalizedPath);
    }
}
