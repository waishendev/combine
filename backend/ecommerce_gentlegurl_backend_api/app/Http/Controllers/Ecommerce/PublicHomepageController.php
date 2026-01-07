<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\HomeSlider;
use App\Models\Marquee;
use App\Models\Promotion;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\PaymentGateway;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\SeoGlobal;
use App\Models\Ecommerce\ShopMenuItem;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PublicHomepageController extends Controller
{
    use ResolvesCurrentCustomer;

    public function show(Request $request)
    {
        $data = Cache::remember('public_homepage_v2', 300, function () {
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
                'footer' => SettingService::get('footer', $this->defaultFooterSetting()),
                'page_reviews' => SettingService::get('page_reviews', ['enabled' => true]),
            ];

            $paymentGateways = PaymentGateway::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get([
                    'id',
                    'key',
                    'name',
                    'is_active',
                    'is_default',
                    'config',
                ]);

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
                'payment_gateways' => $paymentGateways,
            ];
        });

        $wishlistIds = $this->resolveWishlistProductIds($request);
        $wishlistLookup = array_flip($wishlistIds);

        $data['new_products'] = $this->mapProductsWithWishlistStatus($data['new_products'], $wishlistLookup);
        $data['best_sellers'] = $this->mapProductsWithWishlistStatus($data['best_sellers'], $wishlistLookup);
        $data['featured_products'] = $this->mapProductsWithWishlistStatus($data['featured_products'], $wishlistLookup);

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
            'currency' => 'MYR',
            'label' => 'Delivery',
            'zones' => [
                'MY_WEST' => [
                    'label' => 'Malaysia (West)',
                    'countries' => ['MY'],
                    'states' => [
                        'Johor',
                        'Kedah',
                        'Kelantan',
                        'Kuala Lumpur',
                        'Melaka',
                        'Negeri Sembilan',
                        'Pahang',
                        'Penang',
                        'Perak',
                        'Perlis',
                        'Putrajaya',
                        'Selangor',
                        'Terengganu',
                    ],
                    'fee' => 10,
                    'free_shipping' => [
                        'enabled' => true,
                        'min_order_amount' => 200,
                    ],
                ],
                'MY_EAST' => [
                    'label' => 'Malaysia (East)',
                    'countries' => ['MY'],
                    'states' => ['Sabah', 'Sarawak', 'Labuan'],
                    'fee' => 20,
                    'free_shipping' => [
                        'enabled' => true,
                        'min_order_amount' => 300,
                    ],
                ],
                'SG' => [
                    'label' => 'Singapore',
                    'countries' => ['SG'],
                    'states' => [],
                    'fee' => 25,
                    'free_shipping' => [
                        'enabled' => false,
                        'min_order_amount' => null,
                    ],
                ],
            ],
            'fallback' => [
                'mode' => 'block_checkout',
                'default_fee' => 0,
            ],
        ];
    }

    /**
     * Clear homepage cache
     */
    public function flushCache(Request $request)
    {
        try {
            // Clear the homepage cache
            Cache::forget('public_homepage_v2');
            
            // Optionally clear all homepage related caches
            Cache::forget('public_homepage_v1');
            
            return response()->json([
                'success' => true,
                'message' => 'Homepage cache cleared successfully',
                'data' => [
                    'cleared_keys' => ['public_homepage_v2', 'public_homepage_v1'],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to clear cache: ' . $e->getMessage(),
                'data' => null,
            ], 500);
        }
    }

    protected function resolveWishlistProductIds(Request $request): array
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($request->query('session_token') ?? $request->cookie('shop_session_token'));

        if (!$customer && !$sessionToken) {
            return [];
        }

        $query = $customer
            ? DB::table('customer_wishlist_items')->where('customer_id', $customer->id)
            : DB::table('guest_wishlist_items')->where('session_token', $sessionToken);

        return $query->pluck('product_id')->all();
    }

    protected function mapProductsWithWishlistStatus($products, array $wishlistLookup)
    {
        return collect($products)->map(function (Product $product) use ($wishlistLookup) {
            $product->setAttribute('is_in_wishlist', isset($wishlistLookup[$product->id]));
            return $product;
        });
    }

    protected function defaultFooterSetting(): array
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
}
