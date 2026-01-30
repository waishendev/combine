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
            ->first();

        if (! $page) {
            $menuItem = ServicesMenuItem::query()
                ->where('slug', $slug)
                ->where('is_active', true)
                ->firstOrFail();

            return $this->respond([
                'id' => null,
                'menu_item_id' => $menuItem->id,
                'title' => $menuItem->name,
                'slug' => $menuItem->slug,
                'subtitle' => null,
                'hero_slides' => [],
                'sections' => $this->defaultSections(),
            ]);
        }

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
