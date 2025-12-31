<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\HomeSlider;
use App\Models\Marquee;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductImage;
use App\Models\Ecommerce\ShopMenuItem;
use App\Models\Ecommerce\PageReview;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
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
        // Ecommerce Core Settings
        $this->seedSeoGlobal();
        $this->seedLoyaltySettings();
        $this->seedPaymentGateways();
        // $this->seedNotificationTemplates();

        // Membership Tiers (must be before frontend data)
        $this->seedMembershipTiers();

        // // Frontend Test Data
        // // 1. Shop Menu Items
        // $this->seedShopMenuItems();

        // // 2. Categories
        // $categories = $this->seedCategories();

        // // 3. Link Categories to Shop Menu Items
        // $this->linkCategoriesToShopMenus($categories);

        // // 4. Products
        // $products = $this->seedProducts();

        // // 5. Link Products to Categories
        // $this->linkProductsToCategories($products, $categories);

        // // 6. Product Images
        // $this->seedProductImages($products);

        // // 7. Store Locations
        // $this->seedStoreLocations();

        // // 8. Page Reviews
        // $this->seedPageReviews();

        // // 9. Marquee
        // $this->seedMarquees();

        // // 10. Vouchers
        // $this->seedVouchers();

        // // 11. Announcements
        // $this->seedAnnouncements();

        // // 12. Home Sliders
        // $this->seedHomeSliders();
    }

}
