<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\HomeSlider;
use App\Models\Marquee;
use App\Models\Promotion;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\SeoGlobal;
use App\Models\Ecommerce\ShopMenuItem;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class PublicHomepageController extends Controller
{
    public function show()
    {
        $data = Cache::remember('public_homepage_v1', 300, function () {
            $now = Carbon::now();

            $sliders = HomeSlider::query()
                ->where('is_active', true)
                ->where(function ($q) use ($now) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
                })
                ->orderBy('sort_order')
                ->get([
                    'id',
                    'title',
                    'subtitle',
                    'image_path',
                    'mobile_image_path',
                    'button_label',
                    'button_link',
                    'sort_order',
                ]);

            $marquees = Marquee::query()
                ->where('is_active', true)
                ->where(function ($q) use ($now) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
                })
                ->orderBy('sort_order')
                ->get([
                    'id',
                    'text',
                    'sort_order',
                ]);

            $announcements = Announcement::query()
                ->where('is_active', true)
                ->where(function ($q) use ($now) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
                })
                ->orderByDesc('created_at')
                ->get([
                    'id',
                    'title',
                    'body_text as content',
                    'image_path',
                    'button_label',
                    'button_link',
                ]);

            $shopMenu = ShopMenuItem::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get([
                    'id',
                    'name as label',
                    'slug',
                    'sort_order',
                ]);

            // Get product sections
            $newProductConfig = SettingService::get('new_products', ['days' => 30]);
            $bestSellerConfig = SettingService::get('best_sellers', ['days' => 60]);

            $newProductDays = (int) ($newProductConfig['days'] ?? 30);
            $bestSellerDays = (int) ($bestSellerConfig['days'] ?? 60);

            $newProducts = Product::query()
                ->with(['categories', 'images'])
                ->where('is_active', true)
                ->where('created_at', '>=', $now->copy()->subDays($newProductDays))
                ->orderByDesc('created_at')
                ->limit(20)
                ->get();

            $bestSellerProductIds = OrderItem::query()
                ->where('created_at', '>=', $now->copy()->subDays($bestSellerDays))
                ->selectRaw('product_id, SUM(quantity) AS total_qty')
                ->groupBy('product_id')
                ->orderByDesc('total_qty')
                ->limit(20)
                ->pluck('product_id')
                ->toArray();

            $bestSellersQuery = Product::query()
                ->with(['categories', 'images'])
                ->whereIn('id', $bestSellerProductIds)
                ->where('is_active', true);

            if (! empty($bestSellerProductIds)) {
                $idsString = implode(',', array_map('intval', $bestSellerProductIds));
                $bestSellersQuery->orderByRaw("array_position(ARRAY[{$idsString}]::bigint[], id)");
            }

            $bestSellers = $bestSellersQuery->get();

            $featuredProducts = Product::query()
                ->with(['categories', 'images'])
                ->where('is_active', true)
                ->where('is_featured', true)
                ->orderByDesc('created_at')
                ->limit(20)
                ->get();

            $seoGlobal = SeoGlobal::query()->first();

            $seo = null;
            if ($seoGlobal) {
                $seo = [
                    'meta_title' => $seoGlobal->default_title,
                    'meta_description' => $seoGlobal->default_description,
                    'meta_keywords' => $seoGlobal->default_keywords,
                    'meta_og_image' => $seoGlobal->default_og_image,
                ];
            }

            $settings = [
                'shop_contact_widget' => SettingService::get('shop_contact_widget', $this->defaultShopContactWidget()),
                'homepage_products' => SettingService::get('homepage_products', $this->defaultHomepageProducts()),
                'shipping' => SettingService::get('shipping', $this->defaultShippingSetting()),
            ];

            return [
                'sliders' => $sliders,
                'marquees' => $marquees,
                'announcements' => $announcements,
                'shop_menu' => $shopMenu,
                'new_products' => $newProducts,
                'best_sellers' => $bestSellers,
                'featured_products' => $featuredProducts,
                'seo' => $seo,
                'contact' => $settings['shop_contact_widget'],
                'settings' => $settings,
            ];
        });

        return response()->json([
            'data' => $data,
            'success' => true,
            'message' => null,
        ]);
    }

    protected function defaultShopContactWidget(): array
    {
        return [
            'whatsapp' => [
                'enabled' => false,
                'phone' => null,
                'default_message' => null,
            ],
        ];
    }

    protected function defaultHomepageProducts(): array
    {
        return [
            'new_products_days' => 30,
            'best_sellers_days' => 60,
        ];
    }

    protected function defaultShippingSetting(): array
    {
        return [
            'enabled' => true,
            'flat_fee' => 0,
            'currency' => 'MYR',
            'label' => 'Flat Rate Shipping',
        ];
    }
}
