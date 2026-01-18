<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\HomeSlider;
use App\Models\Marquee;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductImage;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ShopMenuItem;
use App\Models\Ecommerce\PageReview;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\Voucher;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\NotificationTemplate;
use App\Models\Ecommerce\PaymentGateway;
use App\Models\Ecommerce\SeoGlobal;
use Illuminate\Database\Seeder;

class FrontendTestDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedNotificationTemplates();

        // Frontend Test Data
        // 1. Shop Menu Items
        $this->seedShopMenuItems();

        // 2. Categories
        $categories = $this->seedCategories();

        // 3. Link Categories to Shop Menu Items
        $this->linkCategoriesToShopMenus($categories);

        // 4. Products
        $products = $this->seedProducts();

        // 4.1 Product Variants
        $this->seedProductVariants($products);

        // 5. Link Products to Categories
        $this->linkProductsToCategories($products, $categories);

        // 6. Product Images
        $this->seedProductImages($products);

        // 7. Store Locations
        $this->seedStoreLocations();

        // 8. Page Reviews
        $this->seedPageReviews();

        // 9. Marquee
        $this->seedMarquees();

        // 10. Vouchers
        $this->seedVouchers();

        // 11. Announcements
        $this->seedAnnouncements();

        // 12. Home Sliders
        $this->seedHomeSliders();
    }

    private function seedShopMenuItems(): array
    {
        $menuItems = [
            [
                'name' => '电子产品',
                'slug' => 'electronics',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => '服装时尚',
                'slug' => 'fashion',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => '家居用品',
                'slug' => 'home-living',
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'name' => '美妆护肤',
                'slug' => 'beauty',
                'sort_order' => 4,
                'is_active' => true,
            ],
            [
                'name' => '运动健身',
                'slug' => 'sports',
                'sort_order' => 5,
                'is_active' => true,
            ],
        ];

        $created = [];
        foreach ($menuItems as $item) {
            $created[] = ShopMenuItem::updateOrCreate(
                ['slug' => $item['slug']],
                $item
            );
        }

        return $created;
    }

    private function seedCategories(): array
    {
        // Parent Categories
        $parentCategories = [
            [
                'name' => '手机与配件',
                'slug' => 'mobile-accessories',
                'description' => '智能手机、手机壳、充电器等配件',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'name' => '电脑与周边',
                'slug' => 'computers',
                'description' => '笔记本电脑、台式机、外设等',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'name' => '男装',
                'slug' => 'men-clothing',
                'description' => '男士服装、配饰',
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'name' => '女装',
                'slug' => 'women-clothing',
                'description' => '女士服装、配饰',
                'sort_order' => 4,
                'is_active' => true,
            ],
            [
                'name' => '家具',
                'slug' => 'furniture',
                'description' => '沙发、桌椅、床具等',
                'sort_order' => 5,
                'is_active' => true,
            ],
            [
                'name' => '装饰用品',
                'slug' => 'decor',
                'description' => '装饰画、花瓶、摆件等',
                'sort_order' => 6,
                'is_active' => true,
            ],
        ];

        $createdParents = [];
        foreach ($parentCategories as $category) {
            $createdParents[] = Category::updateOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }

        // Child Categories
        $childCategories = [
            [
                'parent_id' => $createdParents[0]->id, // 手机与配件
                'name' => '智能手机',
                'slug' => 'smartphones',
                'description' => 'iPhone、Android手机',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[0]->id,
                'name' => '手机壳',
                'slug' => 'phone-cases',
                'description' => '各种手机保护壳',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[0]->id,
                'name' => '充电器',
                'slug' => 'chargers',
                'description' => '充电线、无线充电器等',
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[1]->id, // 电脑与周边
                'name' => '笔记本电脑',
                'slug' => 'laptops',
                'description' => '各种品牌笔记本电脑',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[1]->id,
                'name' => '键盘鼠标',
                'slug' => 'keyboard-mouse',
                'description' => '机械键盘、无线鼠标等',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[2]->id, // 男装
                'name' => 'T恤',
                'slug' => 'men-tshirts',
                'description' => '男士T恤',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[2]->id,
                'name' => '牛仔裤',
                'slug' => 'men-jeans',
                'description' => '男士牛仔裤',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[3]->id, // 女装
                'name' => '连衣裙',
                'slug' => 'women-dresses',
                'description' => '女士连衣裙',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'parent_id' => $createdParents[3]->id,
                'name' => '包包',
                'slug' => 'women-bags',
                'description' => '女士手袋、背包',
                'sort_order' => 2,
                'is_active' => true,
            ],
        ];

        $createdChildren = [];
        foreach ($childCategories as $category) {
            $createdChildren[] = Category::updateOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }

        return array_merge($createdParents, $createdChildren);
    }

    private function linkCategoriesToShopMenus(array $categories): void
    {
        $menuItems = ShopMenuItem::all();
        
        // Link categories to appropriate shop menus
        if ($menuItems->count() > 0 && count($categories) > 0) {
            // Electronics menu -> Mobile & Computer categories
            $electronicsMenu = $menuItems->where('slug', 'electronics')->first();
            if ($electronicsMenu) {
                $electronicsCategories = array_filter($categories, function($cat) {
                    return in_array($cat->slug, ['mobile-accessories', 'computers', 'smartphones', 'phone-cases', 'chargers', 'laptops', 'keyboard-mouse']);
                });
                foreach ($electronicsCategories as $index => $category) {
                    $electronicsMenu->categories()->syncWithoutDetaching([
                        $category->id => ['sort_order' => $index + 1]
                    ]);
                }
            }

            // Fashion menu -> Clothing categories
            $fashionMenu = $menuItems->where('slug', 'fashion')->first();
            if ($fashionMenu) {
                $fashionCategories = array_filter($categories, function($cat) {
                    return in_array($cat->slug, ['men-clothing', 'women-clothing', 'men-tshirts', 'men-jeans', 'women-dresses', 'women-bags']);
                });
                foreach ($fashionCategories as $index => $category) {
                    $fashionMenu->categories()->syncWithoutDetaching([
                        $category->id => ['sort_order' => $index + 1]
                    ]);
                }
            }

            // Home & Living menu -> Furniture & Decor categories
            $homeMenu = $menuItems->where('slug', 'home-living')->first();
            if ($homeMenu) {
                $homeCategories = array_filter($categories, function($cat) {
                    return in_array($cat->slug, ['furniture', 'decor']);
                });
                foreach ($homeCategories as $index => $category) {
                    $homeMenu->categories()->syncWithoutDetaching([
                        $category->id => ['sort_order' => $index + 1]
                    ]);
                }
            }
        }
    }

    private function seedProducts(): array
    {
        $products = [
            // Electronics
            [
                'name' => 'iPhone 15 Pro Max',
                'slug' => 'iphone-15-pro-max',
                'sku' => 'IP15PM-256-BLK',
                'type' => 'single',
                'description' => 'Apple iPhone 15 Pro Max 256GB 钛金属黑色，配备A17 Pro芯片，6.7英寸Super Retina XDR显示屏。',
                'price' => 4999.00,
                'sale_price' => 4599.00,
                'cost_price' => 4200.00,
                'stock' => 9,
                'low_stock_threshold' => 10,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
                'meta_title' => 'iPhone 15 Pro Max - 最新苹果手机',
                'meta_description' => '购买最新款iPhone 15 Pro Max，享受最强大的性能和最优秀的摄影体验。',
            ],
            [
                'name' => 'Samsung Galaxy S24 Ultra',
                'slug' => 'samsung-galaxy-s24-ultra',
                'sku' => 'SG24U-512-SLV',
                'type' => 'single',
                'description' => 'Samsung Galaxy S24 Ultra 512GB 银色，200MP相机，S Pen支持。',
                'price' => 4599.00,
                'cost_price' => 3800.00,
                'stock' => 30,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            [
                'name' => '透明防摔手机壳',
                'slug' => 'clear-phone-case',
                'sku' => 'PHC-CLR-001',
                'type' => 'single',
                'description' => '适用于iPhone 15系列，透明TPU材质，防摔防刮。',
                'price' => 39.90,
                'cost_price' => 15.00,
                'stock' => 200,
                'low_stock_threshold' => 20,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            [
                'name' => 'MagSafe无线充电器',
                'slug' => 'magsafe-wireless-charger',
                'sku' => 'CHG-MS-001',
                'type' => 'single',
                'description' => 'Apple MagSafe兼容无线充电器，15W快充。',
                'price' => 199.00,
                'cost_price' => 80.00,
                'stock' => 150,
                'low_stock_threshold' => 15,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            [
                'name' => 'MacBook Pro 16寸 M3 Pro',
                'slug' => 'macbook-pro-16-m3',
                'sku' => 'MBP16-M3-1TB',
                'type' => 'single',
                'description' => 'Apple MacBook Pro 16寸，M3 Pro芯片，1TB SSD，18核GPU。',
                'price' => 18999.00,
                'cost_price' => 16500.00,
                'stock' => 15,
                'low_stock_threshold' => 3,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            [
                'name' => '机械键盘 RGB',
                'slug' => 'mechanical-keyboard-rgb',
                'sku' => 'KB-MECH-RGB',
                'type' => 'single',
                'description' => '87键机械键盘，RGB背光，青轴。',
                'price' => 599.00,
                'cost_price' => 250.00,
                'stock' => 80,
                'low_stock_threshold' => 10,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            // Fashion
            [
                'name' => '男士纯棉T恤',
                'slug' => 'men-cotton-tshirt',
                'sku' => 'TSH-M-COT-001',
                'type' => 'single',
                'description' => '100%纯棉，舒适透气，多色可选。',
                'price' => 89.00,
                'cost_price' => 35.00,
                'stock' => 300,
                'low_stock_threshold' => 30,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            [
                'name' => '运动连帽卫衣',
                'slug' => 'sports-hoodie',
                'sku' => 'HD-S-BASE',
                'type' => 'variant',
                'description' => '舒适加绒连帽卫衣，多尺码可选。',
                'price' => 129.00,
                'cost_price' => 65.00,
                'stock' => 0,
                'low_stock_threshold' => 0,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            [
                'name' => '男士修身牛仔裤',
                'slug' => 'men-slim-jeans',
                'sku' => 'JEANS-M-SLM-001',
                'type' => 'single',
                'description' => '修身版型，弹力面料，多尺码可选。',
                'price' => 299.00,
                'cost_price' => 120.00,
                'stock' => 150,
                'low_stock_threshold' => 20,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            [
                'name' => '女士夏季连衣裙',
                'slug' => 'women-summer-dress',
                'sku' => 'DRS-W-SUM-001',
                'type' => 'single',
                'description' => '清爽透气，优雅设计，适合夏季穿着。',
                'price' => 399.00,
                'cost_price' => 150.00,
                'stock' => 120,
                'low_stock_threshold' => 15,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            [
                'name' => '女士真皮手提包',
                'slug' => 'women-leather-handbag',
                'sku' => 'BAG-W-LTH-001',
                'type' => 'single',
                'description' => '真皮材质，精致做工，大容量设计。',
                'price' => 899.00,
                'cost_price' => 400.00,
                'stock' => 50,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            // Home & Living
            [
                'name' => '北欧风格沙发',
                'slug' => 'nordic-sofa',
                'sku' => 'SOFA-NRD-001',
                'type' => 'single',
                'description' => '3人位沙发，舒适柔软，现代简约风格。',
                'price' => 2999.00,
                'cost_price' => 1800.00,
                'stock' => 20,
                'low_stock_threshold' => 2,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => true,
            ],
            [
                'name' => '现代简约餐桌椅套装',
                'slug' => 'modern-dining-set',
                'sku' => 'DINE-MOD-001',
                'type' => 'single',
                'description' => '1桌4椅，实木材质，适合小户型。',
                'price' => 1899.00,
                'cost_price' => 1000.00,
                'stock' => 25,
                'low_stock_threshold' => 3,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
            [
                'name' => '装饰画组合套装',
                'slug' => 'wall-art-set',
                'sku' => 'ART-DEC-001',
                'type' => 'single',
                'description' => '3幅画组合，现代抽象风格，提升家居品味。',
                'price' => 299.00,
                'cost_price' => 120.00,
                'stock' => 100,
                'low_stock_threshold' => 10,
                'track_stock' => true,
                'is_active' => true,
                'is_featured' => false,
            ],
        ];

        $created = [];
        foreach ($products as $product) {
            $created[] = Product::updateOrCreate(
                ['slug' => $product['slug']],
                $product
            );
        }

        return $created;
    }

    private function seedProductVariants(array $products): void
    {
        $productMap = [];
        foreach ($products as $product) {
            $productMap[$product->slug] = $product;
        }

        $hoodie = $productMap['sports-hoodie'] ?? null;
        if (! $hoodie) {
            return;
        }

        $variants = [
            [
                'product_id' => $hoodie->id,
                'sku' => 'HD-S-S',
                'title' => 'Size S',
                'price' => 129.00,
                'sale_price' => 99.00,
                'cost_price' => 65.00,
                'stock' => 25,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'product_id' => $hoodie->id,
                'sku' => 'HD-S-M',
                'title' => 'Size M',
                'price' => 129.00,
                'sale_price' => null,
                'cost_price' => 65.00,
                'stock' => 30,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'product_id' => $hoodie->id,
                'sku' => 'HD-S-L',
                'title' => 'Size L',
                'price' => 139.00,
                'sale_price' => 109.00,
                'cost_price' => 70.00,
                'stock' => 20,
                'low_stock_threshold' => 5,
                'track_stock' => true,
                'is_active' => true,
                'sort_order' => 3,
            ],
        ];

        foreach ($variants as $variant) {
            ProductVariant::updateOrCreate(
                [
                    'product_id' => $variant['product_id'],
                    'sku' => $variant['sku'],
                ],
                $variant
            );
        }
    }

    private function linkProductsToCategories(array $products, array $categories): void
    {
        $categoryMap = [];
        foreach ($categories as $category) {
            $categoryMap[$category->slug] = $category->id;
        }

        $productMap = [];
        foreach ($products as $product) {
            $productMap[$product->slug] = $product;
        }

        // Link products to categories
        $links = [
            'iphone-15-pro-max' => ['smartphones', 'mobile-accessories'],
            'samsung-galaxy-s24-ultra' => ['smartphones', 'mobile-accessories'],
            'clear-phone-case' => ['phone-cases', 'mobile-accessories'],
            'magsafe-wireless-charger' => ['chargers', 'mobile-accessories'],
            'macbook-pro-16-m3' => ['laptops', 'computers'],
            'mechanical-keyboard-rgb' => ['keyboard-mouse', 'computers'],
            'men-cotton-tshirt' => ['men-tshirts', 'men-clothing'],
            'sports-hoodie' => ['men-tshirts', 'men-clothing'],
            'men-slim-jeans' => ['men-jeans', 'men-clothing'],
            'women-summer-dress' => ['women-dresses', 'women-clothing'],
            'women-leather-handbag' => ['women-bags', 'women-clothing'],
            'nordic-sofa' => ['furniture'],
            'modern-dining-set' => ['furniture'],
            'wall-art-set' => ['decor'],
        ];

        foreach ($links as $productSlug => $categorySlugs) {
            if (isset($productMap[$productSlug])) {
                $product = $productMap[$productSlug];
                $categoryIds = [];
                foreach ($categorySlugs as $categorySlug) {
                    if (isset($categoryMap[$categorySlug])) {
                        $categoryIds[] = $categoryMap[$categorySlug];
                    }
                }
                if (!empty($categoryIds)) {
                    $product->categories()->sync($categoryIds);
                }
            }
        }
    }

    private function seedProductImages(array $products): void
    {
        $imagePaths = [
            'iphone-15-pro-max' => [
                ['image_path' => '/images/products/iphone-15-pro-max-1.jpg', 'is_main' => true, 'sort_order' => 1],
                ['image_path' => '/images/products/iphone-15-pro-max-2.jpg', 'is_main' => false, 'sort_order' => 2],
            ],
            'samsung-galaxy-s24-ultra' => [
                ['image_path' => '/images/products/samsung-s24-ultra-1.jpg', 'is_main' => true, 'sort_order' => 1],
                ['image_path' => '/images/products/samsung-s24-ultra-2.jpg', 'is_main' => false, 'sort_order' => 2],
            ],
            'clear-phone-case' => [
                ['image_path' => '/images/products/phone-case-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'magsafe-wireless-charger' => [
                ['image_path' => '/images/products/magsafe-charger-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'macbook-pro-16-m3' => [
                ['image_path' => '/images/products/macbook-pro-1.jpg', 'is_main' => true, 'sort_order' => 1],
                ['image_path' => '/images/products/macbook-pro-2.jpg', 'is_main' => false, 'sort_order' => 2],
            ],
            'mechanical-keyboard-rgb' => [
                ['image_path' => '/images/products/keyboard-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'men-cotton-tshirt' => [
                ['image_path' => '/images/products/tshirt-men-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'sports-hoodie' => [
                ['image_path' => '/images/products/tshirt-men-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'men-slim-jeans' => [
                ['image_path' => '/images/products/jeans-men-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'women-summer-dress' => [
                ['image_path' => '/images/products/dress-women-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'women-leather-handbag' => [
                ['image_path' => '/images/products/handbag-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'nordic-sofa' => [
                ['image_path' => '/images/products/sofa-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'modern-dining-set' => [
                ['image_path' => '/images/products/dining-set-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
            'wall-art-set' => [
                ['image_path' => '/images/products/wall-art-1.jpg', 'is_main' => true, 'sort_order' => 1],
            ],
        ];

        foreach ($products as $product) {
            if (isset($imagePaths[$product->slug])) {
                foreach ($imagePaths[$product->slug] as $imageData) {
                    ProductImage::updateOrCreate(
                        [
                            'product_id' => $product->id,
                            'image_path' => $imageData['image_path'],
                        ],
                        [
                            'is_main' => $imageData['is_main'],
                            'sort_order' => $imageData['sort_order'],
                        ]
                    );
                }
            }
        }
    }

    private function seedStoreLocations(): void
    {
        $stores = [
            [
                'name' => '总店 - 吉隆坡市中心',
                'code' => 'KL-001',
                'address_line1' => 'Lot 123, Jalan Bukit Bintang',
                'address_line2' => 'Bukit Bintang',
                'city' => 'Kuala Lumpur',
                'state' => 'Wilayah Persekutuan',
                'postcode' => '50000',
                'country' => 'Malaysia',
                'phone' => '+603-1234-5678',
                'is_active' => true,
                'opening_hours' => [
                    'mon_fri' => '10:00 - 19:00',
                    'sat' => '10:00 - 17:00',
                    'sun' => 'Closed',
                ],
            ],
            [
                'name' => '分店 - 槟城乔治市',
                'code' => 'PNG-001',
                'address_line1' => '88, Jalan Penang',
                'address_line2' => null,
                'city' => 'George Town',
                'state' => 'Penang',
                'postcode' => '10000',
                'country' => 'Malaysia',
                'phone' => '+604-8765-4321',
                'is_active' => true,
                'opening_hours' => [
                    'mon_fri' => '10:00 - 18:00',
                    'sat' => '10:00 - 16:00',
                    'sun' => 'Closed',
                ],
            ],
            [
                'name' => '分店 - 新山',
                'code' => 'JHB-001',
                'address_line1' => 'Level 2, City Square',
                'address_line2' => 'Jalan Wong Ah Fook',
                'city' => 'Johor Bahru',
                'state' => 'Johor',
                'postcode' => '80000',
                'country' => 'Malaysia',
                'phone' => '+607-1111-2222',
                'is_active' => true,
                'opening_hours' => [
                    'mon_fri' => '10:00 - 18:30',
                    'sat' => '10:00 - 17:00',
                    'sun' => 'Closed',
                ],
            ],
        ];

        foreach ($stores as $store) {
            $storeModel = StoreLocation::updateOrCreate(
                ['code' => $store['code']],
                $store
            );

            $images = [
                "/images/stores/{$store['code']}-1.jpg",
                "/images/stores/{$store['code']}-2.jpg",
            ];

            foreach ($images as $index => $imagePath) {
                StoreLocationImage::updateOrCreate(
                    [
                        'store_location_id' => $storeModel->id,
                        'image_path' => $imagePath,
                    ],
                    ['sort_order' => $index]
                );
            }
        }
    }

    private function seedPageReviews(): void
    {
        $storeLocations = StoreLocation::where('is_active', true)->get();

        if ($storeLocations->isEmpty()) {
            return;
        }

        $reviews = [
            [
                'store_code' => 'KL-001',
                'name' => 'Aisyah',
                'email' => 'aisyah@example.com',
                'rating' => 5,
                'title' => 'Amazing service',
                'body' => 'Staff were super helpful and friendly. Will definitely come back again!',
            ],
            [
                'store_code' => 'PNG-001',
                'name' => 'Wei Jun',
                'email' => 'weijun@example.com',
                'rating' => 4,
                'title' => 'Great selection',
                'body' => 'Good variety of products and the store is clean. Checkout could be faster.',
            ],
            [
                'store_code' => 'JHB-001',
                'name' => 'Siti',
                'email' => null,
                'rating' => 5,
                'title' => 'Love the ambience',
                'body' => 'The store layout is cozy and the team gave great recommendations.',
            ],
        ];

        foreach ($reviews as $review) {
            $store = $storeLocations->firstWhere('code', $review['store_code']) ?? $storeLocations->first();

            if (! $store) {
                continue;
            }

            PageReview::firstOrCreate(
                [
                    'store_location_id' => $store->id,
                    'name' => $review['name'],
                    'title' => $review['title'],
                ],
                [
                    'email' => $review['email'],
                    'rating' => $review['rating'],
                    'body' => $review['body'],
                ]
            );
        }
    }

    private function seedMarquees(): void
    {
        $marquees = [
            [
                'text' => '🎉 新用户注册即送RM10优惠券！立即注册享受优惠',
                'start_at' => now()->subDays(7),
                'end_at' => now()->addDays(30),
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'text' => '🚚 全马免费配送，满RM100免运费',
                'start_at' => now()->subDays(1),
                'end_at' => now()->addDays(60),
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'text' => '💳 支持多种支付方式：信用卡、FPX、电子钱包',
                'start_at' => null,
                'end_at' => null,
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'text' => '⭐ 会员积分系统上线！购物即享积分回馈',
                'start_at' => now(),
                'end_at' => now()->addDays(90),
                'is_active' => true,
                'sort_order' => 4,
            ],
        ];

        foreach ($marquees as $marquee) {
            Marquee::create($marquee);
        }
    }

    private function seedVouchers(): void
    {
        $vouchers = [
            [
                'code' => 'WELCOME10',
                'type' => 'fixed',
                'value' => 10.00,
                'usage_limit_total' => 1000,
                'usage_limit_per_customer' => 1,
                'min_order_amount' => 50.00,
                'max_discount_amount' => null,
                'start_at' => now()->subDays(7),
                'end_at' => now()->addDays(60),
                'is_active' => true,
            ],
            [
                'code' => 'SAVE50',
                'type' => 'fixed',
                'value' => 50.00,
                'usage_limit_total' => 500,
                'usage_limit_per_customer' => 2,
                'min_order_amount' => 200.00,
                'max_discount_amount' => null,
                'start_at' => now(),
                'end_at' => now()->addDays(30),
                'is_active' => true,
            ],
            [
                'code' => 'NEWYEAR20',
                'type' => 'fixed',  // percentage → percent
                'value' => 20.00,     // Percent value = 20 → 20%
                'usage_limit_total' => 2000,
                'usage_limit_per_customer' => 1,
                'min_order_amount' => 100.00,
                'max_discount_amount' => null, // 可选加 cap，例如 50
                'start_at' => now()->subDays(10),
                'end_at' => now()->addDays(20),
                'is_active' => true,
            ],
            [
                'code' => 'VIP100',
                'type' => 'fixed',
                'value' => 100.00,
                'usage_limit_total' => 100,
                'usage_limit_per_customer' => 1,
                'min_order_amount' => 500.00,
                'max_discount_amount' => null,
                'start_at' => now(),
                'end_at' => now()->addDays(90),
                'is_active' => true,
            ],
        ];
    
        foreach ($vouchers as $voucher) {
            Voucher::updateOrCreate(
                ['code' => $voucher['code']],
                $voucher
            );
        }

        $storewideVoucher = Voucher::updateOrCreate(
            ['code' => 'voucher_storewide_10off'],
            [
                'type' => 'percent',
                'value' => 10.00,
                'usage_limit_total' => 1000,
                'usage_limit_per_customer' => 2,
                'min_order_amount' => 0,
                'max_discount_amount' => null,
                'start_at' => now()->subDays(1),
                'end_at' => now()->addDays(45),
                'is_active' => true,
                'scope_type' => 'all',
            ]
        );

        $iphoneVoucher = Voucher::updateOrCreate(
            ['code' => 'voucher_iphone_only'],
            [
                'type' => 'fixed',
                'value' => 20.00,
                'usage_limit_total' => 200,
                'usage_limit_per_customer' => 1,
                'min_order_amount' => 50.00,
                'max_discount_amount' => null,
                'start_at' => now()->subDays(1),
                'end_at' => now()->addDays(30),
                'is_active' => true,
                'scope_type' => 'products',
            ]
        );

        $smartphoneVoucher = Voucher::updateOrCreate(
            ['code' => 'voucher_category_smartphone'],
            [
                'type' => 'percent',
                'value' => 15.00,
                'usage_limit_total' => 300,
                'usage_limit_per_customer' => 2,
                'min_order_amount' => 100.00,
                'max_discount_amount' => 80.00,
                'start_at' => now()->subDays(1),
                'end_at' => now()->addDays(30),
                'is_active' => true,
                'scope_type' => 'categories',
            ]
        );

        $iphoneProduct = Product::where('slug', 'iphone-15-pro-max')->first();
        if ($iphoneProduct) {
            $iphoneVoucher->products()->sync([$iphoneProduct->id]);
        }

        $smartphoneCategory = Category::where('slug', 'smartphones')->first();
        if ($smartphoneCategory) {
            $smartphoneVoucher->categories()->sync([$smartphoneCategory->id]);
        }

        $storewideVoucher->products()->sync([]);
        $storewideVoucher->categories()->sync([]);
    }

    private function seedNotificationTemplates(): void
    {
        NotificationTemplate::updateOrCreate(
            ['key' => 'low_stock_email_admin'],
            [
                'channel' => 'email',
                'name' => 'Low Stock Email (Admin)',
                'subject_template' => 'Stock running low for {product_name}',
                'body_template' => 'Hello admin, product {product_name} is below threshold.',
                'variables' => ['{product_name}', '{threshold}'],
                'is_active' => true,
            ]
        );

        NotificationTemplate::updateOrCreate(
            ['key' => 'low_stock_whatsapp_admin'],
            [
                'channel' => 'whatsapp',
                'name' => 'Low Stock WhatsApp (Admin)',
                'subject_template' => null,
                'body_template' => 'Low stock alert: {product_name} remaining {quantity}.',
                'variables' => ['{product_name}', '{quantity}'],
                'is_active' => true,
            ]
        );

        NotificationTemplate::updateOrCreate(
            ['key' => 'stock.low.admin.email'],
            [
                'channel' => 'email',
                'name' => 'Daily Low Stock Summary (Email)',
                'subject_template' => 'Daily Low Stock Summary - {{date}}',
                'body_template' => "Dear Admin,\n\n以下产品库存低于阈值（{{date}}）：\n\n{{product_list}}\n\n请尽快补货。",
                'variables' => ['{{date}}', '{{product_list}}'],
                'is_active' => true,
            ]
        );

        NotificationTemplate::updateOrCreate(
            ['key' => 'stock.low.admin.whatsapp'],
            [
                'channel' => 'whatsapp',
                'name' => 'Daily Low Stock Summary (WhatsApp)',
                'subject_template' => null,
                'body_template' => "[Low Stock Alert {{date}}]\n{{product_list}}",
                'variables' => ['{{date}}', '{{product_list}}'],
                'is_active' => true,
            ]
        );
    }

    private function seedAnnouncements(): void
    {
        $announcements = [
            [
                'key' => 'new-year-sale',
                'title' => '新年大促销',
                'subtitle' => '全场最高20%折扣',
                'body_text' => '新年特惠活动正在进行中！全场商品最高享受20%折扣，更有超值优惠等你来抢！',
                'image_path' => '/images/announcements/new-year-sale.jpg',
                'button_label' => '立即购物',
                'button_link' => '/shop',
                'is_active' => true,
                'start_at' => now()->subDays(5),
                'end_at' => now()->addDays(25),
                'show_once_per_session' => false,
                'sort_order' => 1,
            ],
            [
                'key' => 'free-shipping',
                'title' => '免费配送',
                'subtitle' => '满RM100免运费',
                'body_text' => '即日起，单笔订单满RM100即可享受全马免费配送服务！',
                'image_path' => '/images/announcements/free-shipping.jpg',
                'button_label' => '查看详情',
                'button_link' => '/shipping-info',
                'is_active' => true,
                'start_at' => now(),
                'end_at' => now()->addDays(60),
                'show_once_per_session' => true,
                'sort_order' => 2,
            ],
            [
                'key' => 'membership-launch',
                'title' => '会员系统上线',
                'subtitle' => '积分回馈计划',
                'body_text' => '全新会员积分系统正式上线！购物即可获得积分，积分可兑换优惠券和商品。',
                'image_path' => '/images/announcements/membership.jpg',
                'button_label' => '了解详情',
                'button_link' => '/membership',
                'is_active' => true,
                'start_at' => now()->subDays(3),
                'end_at' => now()->addDays(87),
                'show_once_per_session' => false,
                'sort_order' => 3,
            ],
        ];

        foreach ($announcements as $announcement) {
            Announcement::updateOrCreate(
                ['key' => $announcement['key']],
                $announcement
            );
        }
    }

    private function seedHomeSliders(): void
    {
        $sliders = [
            [
                'title' => '春季新品上市',
                'subtitle' => '探索最新时尚趋势',
                'image_path' => '/images/sliders/spring-collection-desktop.jpg',
                'mobile_image_path' => '/images/sliders/spring-collection-mobile.jpg',
                'button_label' => '立即选购',
                'button_link' => '/shop/fashion',
                'start_at' => now()->subDays(10),
                'end_at' => now()->addDays(50),
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'title' => '电子产品特惠',
                'subtitle' => 'iPhone 15 Pro Max - 最新科技，超值价格',
                'image_path' => '/images/sliders/electronics-sale-desktop.jpg',
                'mobile_image_path' => '/images/sliders/electronics-sale-mobile.jpg',
                'button_label' => '查看详情',
                'button_link' => '/shop/electronics',
                'start_at' => now()->subDays(5),
                'end_at' => now()->addDays(25),
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'title' => '家居用品精选',
                'subtitle' => '打造舒适生活空间',
                'image_path' => '/images/sliders/home-living-desktop.jpg',
                'mobile_image_path' => '/images/sliders/home-living-mobile.jpg',
                'button_label' => '浏览商品',
                'button_link' => '/shop/home-living',
                'start_at' => now(),
                'end_at' => now()->addDays(90),
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'title' => '会员专享优惠',
                'subtitle' => '注册即送RM10优惠券',
                'image_path' => '/images/sliders/membership-desktop.jpg',
                'mobile_image_path' => '/images/sliders/membership-mobile.jpg',
                'button_label' => '立即注册',
                'button_link' => '/register',
                'start_at' => now()->subDays(7),
                'end_at' => now()->addDays(53),
                'is_active' => true,
                'sort_order' => 4,
            ],
        ];

        foreach ($sliders as $slider) {
            HomeSlider::create($slider);
        }
    }
}
