<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Models\Announcement;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\SeoGlobal;
use App\Models\Ecommerce\ShopMenuItem;
use App\Models\HomeSlider;
use App\Models\Marquee;
use App\Models\Promotion;
use App\Services\Ecommerce\ProductReviewService;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class PublicShopController extends Controller
{
    use ResolvesCurrentCustomer;

    public function menu()
    {
        $items = ShopMenuItem::where('is_active', true)
            ->with(['categories' => function ($query) {
                $query->where('is_active', true)
                    ->orderBy('category_shop_menu_items.sort_order')
                    ->orderBy('name');
            }])
            ->orderBy('sort_order')
            ->get();

        $data = $items->map(function (ShopMenuItem $menu) {
            return [
                'id' => $menu->id,
                'title' => $menu->name,
                'slug' => $menu->slug,
                'categories' => $menu->categories->map(function (Category $category) {
                    return [
                        'id' => $category->id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                    ];
                })->values(),
            ];
        });

        return $this->respond($data);
    }

    public function menuDetail(string $slug)
    {
        $item = ShopMenuItem::with(['categories' => function ($query) {
            $query->where('is_active', true)
                ->orderBy('category_shop_menu_items.sort_order')
                ->orderBy('name');
        }])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        $data = [
            'id' => $item->id,
            'title' => $item->name,
            'slug' => $item->slug,
            'categories' => $item->categories->map(function (Category $category) {
                return [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                ];
            })->values(),
        ];

        return $this->respond($data);
    }

    public function categories(Request $request)
    {
        $query = Category::query()
            ->where('is_active', true);

        if ($menuId = $request->query('menu_id')) {
            $query->whereHas('shopMenus', function ($q) use ($menuId) {
                $q->where('shop_menu_items.id', $menuId);
            });
        }

        if ($menuSlug = $request->query('menu_slug')) {
            $query->whereHas('shopMenus', function ($q) use ($menuSlug) {
                $q->where('slug', $menuSlug)
                    ->where('is_active', true);
            });
        }

        $categories = $query
            ->with('shopMenus')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $categories = $categories->map(function (Category $category) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'parent_id' => $category->parent_id,
                'sort_order' => $category->sort_order,
                'menu_ids' => $category->shopMenus->pluck('id')->all(),
            ];
        });

        $groupedByParent = $categories->groupBy('parent_id');

        $buildTree = function ($parentId) use (&$buildTree, $groupedByParent) {
            return $groupedByParent->get($parentId, collect())->map(function ($category) use (&$buildTree) {
                return array_merge($category, [
                    'children' => $buildTree($category['id']),
                ]);
            })->values();
        };

        $tree = $buildTree(null);

        return $this->respond($tree);
    }

    public function products(Request $request)
    {
        $productsQuery = Product::with([
            'categories' => function ($query) {
                $query->select('categories.id', 'categories.name', 'categories.slug');
            },
            'images' => function ($query) {
                $query->orderBy('sort_order')->orderBy('id');
            },
        ])
            ->where('is_active', true)
            ->where('is_reward_only', false);

        $menuId = $request->query('menu_id');
        $menuSlug = $request->query('menu_slug');
        $menuCategoryIds = null;

        if ($menuId || $menuSlug) {
            $menu = ShopMenuItem::with(['categories' => function ($query) {
                $query->where('categories.is_active', true)
                    ->orderBy('category_shop_menu_items.sort_order')
                    ->orderBy('name');
            }])
                ->where('is_active', true)
                ->when($menuId, fn($query) => $query->where('id', $menuId))
                ->when($menuSlug, fn($query) => $query->where('slug', $menuSlug))
                ->first();

            $menuCategoryIds = $menu?->categories->pluck('id')->all() ?? [];

            $productsQuery->whereHas('categories', function ($query) use ($menuCategoryIds) {
                $query->whereIn('categories.id', $menuCategoryIds)
                    ->where('categories.is_active', true);
            });
        }

        $categoryId = $request->query('category_id');
        $categorySlug = $request->query('category_slug') ?? $request->query('category');
        $keyword = $request->get('keyword') ?? $request->get('q') ?? $request->get('search');

        if ($categoryId) {
            $productsQuery->whereHas('categories', function ($query) use ($categoryId, $menuCategoryIds) {
                $query->where('categories.id', $categoryId)
                    ->where('categories.is_active', true);

                if (is_array($menuCategoryIds)) {
                    $query->whereIn('categories.id', $menuCategoryIds);
                }
            });
        }

        if ($categorySlug) {
            $productsQuery->whereHas('categories', function ($query) use ($categorySlug, $menuCategoryIds) {
                $query->where('categories.slug', $categorySlug)
                    ->where('categories.is_active', true);

                if (is_array($menuCategoryIds)) {
                    $query->whereIn('categories.id', $menuCategoryIds);
                }
            });
        }

        if ($keyword) {
            $productsQuery->where(function ($query) use ($keyword) {
                $query->where('name', 'like', "%{$keyword}%")
                    ->orWhere('sku', 'like', "%{$keyword}%");
            });
        }

        if ($request->filled('min_price')) {
            $productsQuery->where('price', '>=', $request->get('min_price'));
        }

        if ($request->filled('max_price')) {
            $productsQuery->where('price', '<=', $request->get('max_price'));
        }

        $sort = $request->get('sort');

        $productsQuery->when(true, function ($query) use ($sort) {
            return match ($sort) {
                'price_asc' => $query->orderBy('price'),
                'price_desc' => $query->orderByDesc('price'),
                default => $query->orderByDesc('created_at'),
            };
        });

        $wishlistIds = $this->resolveWishlistProductIds($request);
        $wishlistLookup = array_flip($wishlistIds);

        $perPage = $request->integer('per_page', $request->integer('limit', 15));
        $products = $productsQuery
            ->paginate($perPage)
            ->appends($request->query());

        $realSoldCounts = $this->calculateRealSoldCounts($products->getCollection()->pluck('id')->all());

        $products->setCollection(
            $products->getCollection()->map(function (Product $product) use ($wishlistLookup, $realSoldCounts) {
                $realSoldCount = $realSoldCounts[$product->id] ?? 0;
                $dummySoldCount = (int) ($product->dummy_sold_count ?? 0);
                $soldCount = $realSoldCount + $dummySoldCount;

                $sortedImages = $product->images
                    ->sortBy('sort_order')
                    ->sortBy('id')
                    ->values()
                    ->map(function ($image) {
                        return [
                            'image_path' => $image->image_path,
                            'sort_order' => $image->sort_order,
                        ];
                    });

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'sku' => $product->sku,
                    'price' => $product->price,
                    'is_in_wishlist' => isset($wishlistLookup[$product->id]),
                    'dummy_sold_count' => $dummySoldCount,
                    'real_sold_count' => $realSoldCount,
                    'sold_count' => $soldCount,
                    'images' => $sortedImages,
                ];
            })
        );

        return response()->json([
            'data' => $products->items(),
            'meta' => [
                'current_page' => $products->currentPage(),
                'from' => $products->firstItem(),
                'last_page' => $products->lastPage(),
                'path' => $products->path(),
                'per_page' => $products->perPage(),
                'to' => $products->lastItem(),
                'total' => $products->total(),
            ],
            'links' => [
                'first' => $products->url(1),
                'last' => $products->url($products->lastPage()),
                'prev' => $products->previousPageUrl(),
                'next' => $products->nextPageUrl(),
            ],
            'success' => true,
            'message' => null,
        ]);
    }

    public function shipping()
    {
        $shipping = SettingService::get('shipping', [
            'enabled' => true,
            'currency' => 'MYR',
            'label' => 'Delivery',
            'free_shipping' => [
                'enabled' => true,
                'min_order_amount' => 200,
            ],
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
                ],
                'MY_EAST' => [
                    'label' => 'Malaysia (East)',
                    'countries' => ['MY'],
                    'states' => ['Sabah', 'Sarawak', 'Labuan'],
                    'fee' => 20,
                ],
                'SG' => [
                    'label' => 'Singapore',
                    'countries' => ['SG'],
                    'states' => [],
                    'fee' => 25,
                ],
            ],
            'fallback' => [
                'mode' => 'block_checkout',
                'default_fee' => 0,
            ],
        ]);

        return $this->respond($shipping);
    }

    public function showProduct(Request $request, string $slug)
    {
        $allowRewardOnly = $request->boolean('reward', false);

        $product = Product::with(['categories', 'images', 'packageChildren.childProduct'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->when(!$allowRewardOnly, fn($query) => $query->where('is_reward_only', false))
            ->firstOrFail();

        $product->images = $product->images
            ->sortBy('id')
            ->sortBy('sort_order')
            ->values();

        $categories = $product->categories->map(function (Category $category) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
            ];
        });

        $gallery = $product->images->pluck('image_path')->values();

        $isInStock = $product->track_stock ? $product->stock > 0 : true;

        $relatedProducts = [];
        if (!$product->is_reward_only) {
            $relatedProducts = Product::with(['images', 'categories'])
                ->where('is_active', true)
                ->where('id', '!=', $product->id)
                ->whereHas('categories', function ($query) use ($product) {
                    $query->whereIn('categories.id', $product->categories->pluck('id'));
                })
                ->orderByDesc('created_at')
                ->limit(4)
                ->get()
                ->map(function (Product $related) {
                    return [
                        'id' => $related->id,
                        'name' => $related->name,
                        'slug' => $related->slug,
                        'price' => $related->price,
                        'thumbnail' => optional($related->images
                            ->sortBy('id')
                            ->sortBy('sort_order')
                            ->first())->image_path,
                    ];
                });
        }

        $realSoldCountLookup = $this->calculateRealSoldCounts([$product->id]);
        $realSoldCount = $realSoldCountLookup[$product->id] ?? 0;
        $dummySoldCount = (int) ($product->dummy_sold_count ?? 0);
        $soldCount = $realSoldCount + $dummySoldCount;

        $data = [
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'sku' => $product->sku,
            'description' => $product->description,
            'price' => $product->price,
            'stock' => $product->stock,
            'track_stock' => $product->track_stock,
            'is_in_stock' => $isInStock,
            'dummy_sold_count' => $dummySoldCount,
            'real_sold_count' => $realSoldCount,
            'sold_count' => $soldCount,
            'images' => $product->images,
            'gallery' => $gallery,
            'categories' => $categories,
            'package_children' => $product->packageChildren,
            'is_in_wishlist' => in_array($product->id, $this->resolveWishlistProductIds($request)),
            'related_products' => $relatedProducts,
            'is_reward_only' => $product->is_reward_only,
        ];

        $reviewService = app(ProductReviewService::class);
        $reviewSettings = $reviewService->settings();
        $data['review_settings'] = $reviewSettings;

        if ($reviewSettings['enabled'] ?? false) {
            $data['review_summary'] = $reviewService->buildSummary($product->id);
            $data['recent_reviews'] = $reviewService->recentReviews($product->id, 3);
        }

        return $this->respond($data);
    }

    protected function calculateRealSoldCounts(array $productIds): array
    {
        if (empty($productIds)) {
            return [];
        }

        return OrderItem::query()
            ->selectRaw('product_id, SUM(quantity) AS total_qty')
            ->whereIn('product_id', $productIds)
            ->whereHas('order', function ($query) {
                $query->where('payment_status', 'paid');
            })
            ->groupBy('product_id')
            ->pluck('total_qty', 'product_id')
            ->map(fn($qty) => (int) $qty)
            ->all();
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

    public function homepage()
    {
        $now = Carbon::now();

        $newProductConfig = SettingService::get('new_products', ['days' => 30]);
        $bestSellerConfig = SettingService::get('best_sellers', ['days' => 60]);

        $newProductDays = (int) ($newProductConfig['days'] ?? 30);
        $bestSellerDays = (int) ($bestSellerConfig['days'] ?? 60);

        $newProducts = Product::query()
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
            ->whereIn('id', $bestSellerProductIds)
            ->where('is_active', true);

        if (! empty($bestSellerProductIds)) {
            $idsString = implode(',', array_map('intval', $bestSellerProductIds));
            $bestSellersQuery->orderByRaw("array_position(ARRAY[{$idsString}]::bigint[], id)");
        }

        $bestSellers = $bestSellersQuery->get();

        $featuredProducts = Product::query()
            ->where('is_active', true)
            ->where('is_featured', true)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

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

        $promotions = Promotion::query()
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
                'content_html as text',
                'image_path',
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

        return response()->json([
            'settings' => [
                'new_products_days' => $newProductDays,
                'best_sellers_days' => $bestSellerDays,
            ],
            'sliders' => $sliders,
            'promotions' => $promotions,
            'marquees' => $marquees,
            'announcements' => $announcements,
            'featured_products' => $featuredProducts,
            'new_products' => $newProducts,
            'best_sellers' => $bestSellers,
            'shop_menu' => $shopMenu,
            'seo' => $seo,
        ]);
    }
}
