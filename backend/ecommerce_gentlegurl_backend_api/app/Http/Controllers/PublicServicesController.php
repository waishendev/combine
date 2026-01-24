<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;

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

        return $this->respond([
            'id' => $page->id,
            'menu_item_id' => $page->services_menu_item_id,
            'title' => $page->title,
            'slug' => $page->slug,
            'subtitle' => $page->subtitle,
            'hero_slides' => $page->hero_slides,
            'sections' => $page->sections,
        ]);
    }
}
