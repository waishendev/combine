<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerTypeController;
use App\Http\Controllers\Ecommerce\AnnouncementController;
use App\Http\Controllers\Ecommerce\BankAccountController;
use App\Http\Controllers\Ecommerce\CustomerController as EcommerceCustomerController;
use App\Http\Controllers\Ecommerce\OrderController;
use App\Http\Controllers\Ecommerce\OfflineOrderManagementController;
use App\Http\Controllers\Ecommerce\PaymentGatewayController;
use App\Http\Controllers\Ecommerce\PublicCustomerAddressController;
use App\Http\Controllers\Ecommerce\CartMergeController;
use App\Http\Controllers\Ecommerce\MarqueeController;
use App\Http\Controllers\Ecommerce\HomeSliderController;
use App\Http\Controllers\Ecommerce\PublicAnnouncementController;
use App\Http\Controllers\Ecommerce\DashboardController;
use App\Http\Controllers\Ecommerce\BrandingController;
use App\Http\Controllers\Ecommerce\BillplzPaymentGatewayOptionController;
use App\Http\Controllers\Ecommerce\PublicBankAccountController;
use App\Http\Controllers\Ecommerce\PublicCartController;
use App\Http\Controllers\Ecommerce\PublicCheckoutController;
use App\Http\Controllers\Ecommerce\PublicCustomerAuthController;
use App\Http\Controllers\Ecommerce\PublicLoyaltyController;
use App\Http\Controllers\Ecommerce\PublicMarqueeController;
use App\Http\Controllers\Ecommerce\PublicOrderTrackingController;
use App\Http\Controllers\Ecommerce\PublicPaymentMethodController;
use App\Http\Controllers\Ecommerce\PublicPromotionController;
use App\Http\Controllers\Ecommerce\PublicPageReviewController;
use App\Http\Controllers\Ecommerce\PublicHomeSliderController;
use App\Http\Controllers\Ecommerce\PublicOrderHistoryController;
use App\Http\Controllers\Ecommerce\PublicProductReviewController;
use App\Http\Controllers\Ecommerce\PublicReturnController;
use App\Http\Controllers\Ecommerce\PublicWishlistController;
use App\Http\Controllers\Ecommerce\PublicStoreLocationController;
use App\Http\Controllers\Ecommerce\PromotionController;
use App\Http\Controllers\Ecommerce\PosController;
use App\Http\Controllers\Ecommerce\PublicReceiptController;
use App\Http\Controllers\Ecommerce\PublicVoucherController;
use App\Http\Controllers\Ecommerce\ProductStockMovementController;
use App\Http\Controllers\Ecommerce\ProductVariantBundleItemController;
use App\Http\Controllers\Ecommerce\ReturnRequestController;
use App\Http\Controllers\Ecommerce\PublicAccountController;
use App\Http\Controllers\Ecommerce\VoucherController;
use App\Http\Controllers\Ecommerce\VoucherAssignLogController;
use App\Http\Controllers\Ecommerce\SalesReportController;
use App\Http\Controllers\Ecommerce\Reports\SalesReportExportController;
use App\Http\Controllers\Ecommerce\Reports\StaffCommissionReportController;
use App\Http\Controllers\Ecommerce\Reports\MyPosSummaryReportController;
use App\Http\Controllers\Ecommerce\Reports\PosSummaryReportController;
use App\Http\Controllers\Ecommerce\Reports\SalesChannelReportController;
use App\Http\Controllers\Ecommerce\Reports\CustomerSalesDomainReportController;
use App\Http\Controllers\Ecommerce\LoyaltyAdminController;
use App\Http\Controllers\Ecommerce\LoyaltyRewardController;
use App\Http\Controllers\Ecommerce\LoyaltyRedemptionAdminController;
use App\Http\Controllers\Ecommerce\ShopSettingController;
use App\Http\Controllers\LoyaltySettingController;
use App\Http\Controllers\MembershipTierRuleController;
use App\Http\Controllers\NotificationTemplateController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PermissionGroupController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductMediaController;
use App\Http\Controllers\PublicShopController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SeoGlobalController;
use App\Http\Controllers\ShopMenuItemController;
use App\Http\Controllers\ServicesMenuItemController;
use App\Http\Controllers\ServicesPageController;
use App\Http\Controllers\StoreLocationController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\ServicePackageRedeemController;
use App\Http\Controllers\CustomerServicePackageController;
use App\Http\Controllers\ServicePackageController;
use App\Http\Controllers\Payments\BillplzCallbackController;
use App\Http\Controllers\PublicServicesController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Ecommerce\PublicHomepageController;


Route::prefix('/public/auth')->middleware('api.session')->group(function () {
    Route::post('/register', [PublicCustomerAuthController::class, 'register']);
    Route::post('/login', [PublicCustomerAuthController::class, 'login']);
    Route::post('/logout', [PublicCustomerAuthController::class, 'logout'])
        ->middleware('auth:customer');

    Route::get('/profile', [PublicCustomerAuthController::class, 'profile'])
        ->middleware('auth:customer,sanctum');

    Route::put('/profile', [PublicCustomerAuthController::class, 'updateProfile'])
        ->middleware('auth:customer,sanctum');

    Route::put('/password', [PublicCustomerAuthController::class, 'changePassword'])
        ->middleware('auth:customer,sanctum');

    Route::middleware('auth:customer,sanctum')->group(function () {
        Route::get('/addresses', [PublicCustomerAddressController::class, 'index']);
        Route::post('/addresses', [PublicCustomerAddressController::class, 'store']);
        Route::put('/addresses/{id}', [PublicCustomerAddressController::class, 'update']);
        Route::delete('/addresses/{id}', [PublicCustomerAddressController::class, 'destroy']);
        Route::put('/addresses/{id}/default', [PublicCustomerAddressController::class, 'makeDefault']);
    });
});

Route::post('/public/auth/login/token', [PublicCustomerAuthController::class, 'loginWithToken']);

Route::prefix('/public/shop/auth')->group(function () {
    Route::post('/email/resend-verification', [PublicCustomerAuthController::class, 'resendVerificationEmail'])
        ->middleware('throttle:6,1');
    Route::get('/email/verify/{id}/{hash}', [PublicCustomerAuthController::class, 'verifyEmail'])
        ->name('verification.verify');
    Route::post('/password/forgot', [PublicCustomerAuthController::class, 'forgotPassword'])
        ->middleware('throttle:6,1');
    Route::post('/password/reset', [PublicCustomerAuthController::class, 'resetPassword']);
});

Route::post('/public/payments/billplz/callback', [BillplzCallbackController::class, 'callback']);
Route::get('/public/payments/billplz/redirect', [BillplzCallbackController::class, 'redirect']);
Route::get('/public/receipt/{token}', [PublicReceiptController::class, 'show']);
Route::get('/public/receipt/{token}/invoice', [PublicReceiptController::class, 'invoice']);
// Backwards compatibility for previous callback URLs
Route::post('/payment/billplz/callback', [BillplzCallbackController::class, 'callback']);
Route::get('/payment/billplz/redirect', [BillplzCallbackController::class, 'redirect']);
Route::get('/payment-gateway-options', [BillplzPaymentGatewayOptionController::class, 'publicIndex']);

// 🛍️ 公共商城接口
Route::prefix('/public/shop')->group(function () {
    // 完全公开，不需要顾客身份
    Route::get('/menu', [PublicShopController::class, 'menu']);
    Route::get('/menu/{slug}', [PublicShopController::class, 'menuDetail']);
    Route::get('/categories', [PublicShopController::class, 'categories']);
    Route::get('/products', [PublicShopController::class, 'products'])
        ->middleware('api.session');
    Route::get('/products/{slug}', [PublicShopController::class, 'showProduct'])
        ->middleware('api.session');
    Route::get('/products/{slug}/reviews', [PublicProductReviewController::class, 'index']);
    Route::get('/products/{slug}/review-eligibility', [PublicProductReviewController::class, 'eligibility'])
        ->middleware('api.session');
    Route::post('/products/{slug}/reviews', [PublicProductReviewController::class, 'store'])
        ->middleware(['api.session', 'auth:customer,sanctum']);
    Route::get('/promotions', [PublicPromotionController::class, 'index']);
    Route::get('/announcements', [PublicAnnouncementController::class, 'index']);
    Route::get('/announcements/{key}', [PublicAnnouncementController::class, 'showByKey']);
    Route::get('/marquees', [PublicMarqueeController::class, 'index']);
    Route::get('/sliders', [PublicHomeSliderController::class, 'index']);
    Route::get('/homepage', [PublicHomepageController::class, 'show'])
        ->middleware('api.session');
    Route::post('/homepage/flush-cache', [PublicHomepageController::class, 'flushCache']);
    Route::get('/loyalty/rewards', [PublicLoyaltyController::class, 'rewards'])
        ->middleware('api.session');
    Route::get('/membership/tiers', [PublicLoyaltyController::class, 'membershipTiers']);
    Route::get('/shipping', [PublicShopController::class, 'shipping']);
    Route::get('/store-locations', [PublicStoreLocationController::class, 'index']);
    Route::get('/store-locations/{storeLocation}', [PublicStoreLocationController::class, 'show']);
    Route::get('/reviews/settings', [PublicPageReviewController::class, 'settings']);
    Route::get('/reviews', [PublicPageReviewController::class, 'index']);
    Route::post('/reviews', [PublicPageReviewController::class, 'store']);
    Route::get('/bank-accounts',[PublicBankAccountController::class, 'index']);
    Route::get('/payment-methods', [PublicPaymentMethodController::class, 'index']);
    Route::post('/orders/track', [PublicOrderTrackingController::class, 'track']);

    Route::post('/checkout/preview', [PublicCheckoutController::class, 'preview'])
        ->middleware('api.session');
    Route::post('/orders', [PublicCheckoutController::class, 'createOrder'])
        ->middleware('api.session');
        
    Route::get('/orders/lookup', [PublicCheckoutController::class, 'lookup']);
    Route::post('/orders/{order}/upload-slip', [PublicCheckoutController::class, 'uploadSlip']);
    Route::get('/bookings/lookup', [\App\Http\Controllers\Booking\PaymentController::class, 'publicLookup']);
    Route::post('/bookings/{id}/upload-slip', [\App\Http\Controllers\Booking\PaymentController::class, 'publicUploadSlip']);

    // Cart routes - support both authenticated and guest users via session_token
    Route::middleware('api.session')->group(function () {
        Route::get('/cart', [PublicCartController::class, 'show']);
        Route::post('/cart/items', [PublicCartController::class, 'addOrUpdateItem']);
        Route::post('/cart/items/add', [PublicCartController::class, 'addItemIncrement']);
        Route::patch('/cart/items/{item}', [PublicCartController::class, 'updateItem']);
        Route::delete('/cart/items/{item}', [PublicCartController::class, 'removeItem']);
        Route::post('/cart/reset', [PublicCartController::class, 'reset']);
        Route::post('/cart/reward-items/{item}/cancel', [PublicCartController::class, 'cancelRewardItem']);

        Route::get('/wishlist', [PublicWishlistController::class, 'index']);
        Route::post('/wishlist/toggle', [PublicWishlistController::class, 'toggle']);
    });

    Route::post('/cart/merge', [PublicCartController::class, 'merge'])
        ->middleware(['api.session', 'auth:customer,sanctum']);
    Route::post('/wishlist/merge', [PublicWishlistController::class, 'merge'])
        ->middleware(['api.session', 'auth:customer,sanctum']);

    Route::middleware(['api.session', 'auth:customer,sanctum'])->group(function () {

        Route::get('/account/overview', [PublicAccountController::class, 'overview']);

        // Order History
        Route::get('/bookings', [\App\Http\Controllers\Booking\MyBookingController::class, 'index']);

        Route::get('/orders', [PublicOrderHistoryController::class, 'index']);
        Route::get('/orders/{id}', [PublicOrderHistoryController::class, 
        'showById']);
        Route::post('/orders/{order}/cancel', [PublicOrderHistoryController::class, 'cancel']);
        Route::post('/orders/{order}/pay', [PublicOrderHistoryController::class, 'pay']);
        Route::get('/orders/{order}/invoice', [PublicOrderHistoryController::class, 'invoice']);
        Route::post('/orders/{order}/complete', [PublicOrderHistoryController::class, 'complete']);

        Route::post('/returns', [PublicReturnController::class, 'store']);
        Route::post('/orders/{order}/returns', [PublicReturnController::class, 'store']);
        Route::get('/returns', [PublicReturnController::class, 'index']);
        Route::get('/returns/{returnRequest}', [PublicReturnController::class, 'show']);
        Route::post('/returns/{returnRequest}/tracking', [PublicReturnController::class, 'submitTracking']);

        Route::get('/loyalty/summary', [PublicLoyaltyController::class, 'summary']);
        Route::get('/loyalty/history', [PublicLoyaltyController::class, 'history']);
        Route::post('/loyalty/redeem', [PublicLoyaltyController::class, 'redeem']);

        Route::get('/vouchers', [PublicVoucherController::class, 'index']);
        Route::get('/vouchers/{voucher}', [PublicVoucherController::class, 'show']);
    });
});

Route::prefix('/public/services')->group(function () {
    Route::get('/menu', [PublicServicesController::class, 'menu']);
    Route::get('/pages/{slug}', [PublicServicesController::class, 'show']);
});


// 🔐 session 登录/登出（给 Next.js 用），需要 Session 但 login 不要 auth
Route::middleware('api.session')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::post('/logout', [AuthController::class, 'logout'])
        ->middleware('auth:web'); // 已登录才能 logout 会比较合理
});

// 🔑 token 登录（给 Postman / 其他服务用）
Route::post('/login/token', [AuthController::class, 'loginWithToken']);

// ✅ 所有需要权限控制的受保护路由，抽成一个 closure
$protectedRoutes = function () {

    Route::get('/profile', [AuthController::class, 'profile']);

    Route::get('/me', [AuthController::class, 'me']);

    // Admins (users)
    Route::get('/admins', [AdminController::class, 'index'])
        ->middleware('permission:users.view');

    Route::post('/admins', [AdminController::class, 'store'])
        ->middleware('permission:users.create');

    Route::get('/admins/{admin}', [AdminController::class, 'show'])
        ->middleware('permission:users.view');

    Route::put('/admins/{admin}', [AdminController::class, 'update'])
        ->middleware('permission:users.update');

    Route::delete('/admins/{admin}', [AdminController::class, 'destroy'])
        ->middleware('permission:users.delete');

    // Roles
    // Route::get('/roles/all', [RoleController::class, 'indexAll'])
    //     ->middleware('permission:roles.view-all');

    Route::get('/roles', [RoleController::class, 'index'])
        ->middleware('permission:roles.view');

    Route::post('/roles', [RoleController::class, 'store'])
        ->middleware('permission:roles.create');

    Route::get('/roles/{role}', [RoleController::class, 'show'])
        ->middleware('permission:roles.view');

    Route::get('/roles/{role}/edit', [RoleController::class, 'edit'])
        ->middleware('permission:roles.update');

    Route::put('/roles/{role}', [RoleController::class, 'update'])
        ->middleware('permission:roles.update');

    Route::delete('/roles/{role}', [RoleController::class, 'destroy'])
        ->middleware('permission:roles.delete');

    // Permissions
    Route::get('/permissions/delegatable', [PermissionController::class, 'delegatable'])
        ->middleware('permission:roles.view');

    Route::get('/permissions', [PermissionController::class, 'index'])
        ->middleware('permission:permissions.view');

    Route::post('/permissions', [PermissionController::class, 'store'])
        ->middleware('permission:permissions.create');

    Route::get('/permissions/{permission}', [PermissionController::class, 'show'])
        ->middleware('permission:permissions.view');

    Route::put('/permissions/{permission}', [PermissionController::class, 'update'])
        ->middleware('permission:permissions.update');

    Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy'])
        ->middleware('permission:permissions.delete');

    // Permission Groups
    Route::get('/permission-groups', [PermissionGroupController::class, 'index'])
        ->middleware('permission:permission-groups.view');

    Route::post('/permission-groups', [PermissionGroupController::class, 'store'])
        ->middleware('permission:permission-groups.create');

    Route::get('/permission-groups/{group}', [PermissionGroupController::class, 'show'])
        ->middleware('permission:permission-groups.view');

    Route::put('/permission-groups/{group}', [PermissionGroupController::class, 'update'])
        ->middleware('permission:permission-groups.update');

    Route::delete('/permission-groups/{group}', [PermissionGroupController::class, 'destroy'])
        ->middleware('permission:permission-groups.delete');

    Route::post('/permission-groups/{group}/move-up', [PermissionGroupController::class, 'moveUp'])
        ->middleware('permission:permission-groups.update');

    Route::post('/permission-groups/{group}/move-down', [PermissionGroupController::class, 'moveDown'])
        ->middleware('permission:permission-groups.update');

    // Customers
    Route::get('/customers', [CustomerController::class, 'index'])
        ->middleware('permission:customers.view|pos.checkout');

    Route::get('/customers/export', [CustomerController::class, 'exportCsv'])
        ->middleware('permission:customers.view');

    Route::post('/customers/import', [CustomerController::class, 'importCsv'])
        ->middleware('permission:customers.create');

    Route::post('/customers', [CustomerController::class, 'store'])
        ->middleware('permission:customers.create');

    Route::get('/customers/{customer}', [CustomerController::class, 'show'])
        ->middleware('permission:customers.view');

    Route::put('/customers/{customer}', [CustomerController::class, 'update'])
        ->middleware('permission:customers.update');

    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])
        ->middleware('permission:customers.delete');

    Route::post('/customers/{customer}/verify-email', [CustomerController::class, 'verifyEmail'])
        ->middleware('permission:customers.verify');

    Route::get('/customer-types', [CustomerTypeController::class, 'index'])
        ->middleware('permission:customers.view|customers.create|customers.update|pos.checkout');

    Route::post('/customer-types', [CustomerTypeController::class, 'store'])
        ->middleware('permission:customers.create');

    Route::get('/customer-types/{customerType}', [CustomerTypeController::class, 'show'])
        ->middleware('permission:customers.view');

    Route::put('/customer-types/{customerType}', [CustomerTypeController::class, 'update'])
        ->middleware('permission:customers.update');

    Route::delete('/customer-types/{customerType}', [CustomerTypeController::class, 'destroy'])
        ->middleware('permission:customers.delete');


    Route::get('/service-packages', [ServicePackageController::class, 'index'])
        ->middleware('permission:service-packages.view|pos.checkout');
    Route::get('/service-packages/export', [ServicePackageController::class, 'exportCsv'])
        ->middleware('permission:service-packages.view');
    Route::post('/service-packages/import', [ServicePackageController::class, 'importCsv'])
        ->middleware('permission:service-packages.create|service-packages.update');
    Route::post('/service-packages', [ServicePackageController::class, 'store'])
        ->middleware('permission:service-packages.create');
    Route::get('/service-packages/{id}', [ServicePackageController::class, 'show'])
        ->middleware('permission:service-packages.view');
    Route::put('/service-packages/{id}', [ServicePackageController::class, 'update'])
        ->middleware('permission:service-packages.update');
    Route::delete('/service-packages/{id}', [ServicePackageController::class, 'destroy'])
        ->middleware('permission:service-packages.delete');

    Route::get('/customers/{id}/service-packages', [CustomerServicePackageController::class, 'index'])
        ->middleware('permission:customer-service-packages.view');
    Route::get('/customers/{id}/service-package-balances', [CustomerServicePackageController::class, 'balances'])
        ->middleware('permission:customer-service-packages.view');
    Route::get('/customers/{id}/service-package-usages', [CustomerServicePackageController::class, 'usages'])
        ->middleware('permission:customer-service-packages.view');
    Route::get('/customers/{id}/service-package-available-for/{serviceId}', [CustomerServicePackageController::class, 'availableFor'])
        ->middleware('permission:customer-service-packages.view|pos.checkout');
    Route::post('/service-packages/redeem', [ServicePackageRedeemController::class, 'redeem'])
        ->middleware('permission:customer-service-packages.update|pos.checkout');

    // Staffs
    Route::get('/staffs', [StaffController::class, 'index'])
        ->middleware('permission:staff.view|pos.checkout');
    Route::get('/staffs/export', [StaffController::class, 'exportCsv'])
        ->middleware('permission:staff.view');
    Route::post('/staffs/import', [StaffController::class, 'importCsv'])
        ->middleware('permission:staff.create|staff.update');

    Route::post('/staffs', [StaffController::class, 'store'])
        ->middleware('permission:staff.create');

    Route::get('/staffs/{staff}', [StaffController::class, 'show'])
        ->middleware('permission:staff.view');

    Route::put('/staffs/{staff}', [StaffController::class, 'update'])
        ->middleware('permission:staff.update');

    Route::delete('/staffs/{staff}', [StaffController::class, 'destroy'])
        ->middleware('permission:staff.delete');

    Route::prefix('pos')->middleware('permission:pos.checkout')->group(function () {
        Route::get('/members/search', [PosController::class, 'memberSearch']);
        Route::get('/members/{memberId}', [PosController::class, 'memberDetail']);
        Route::get('/members/{memberId}/vouchers', [PosController::class, 'memberVouchers']);
        Route::get('/products/search', [PosController::class, 'productSearch']);
        Route::get('/services/search', [PosController::class, 'serviceSearch']);
        Route::get('/service-packages/search', [PosController::class, 'packageSearch']);
        Route::get('/appointments', [PosController::class, 'appointmentSearch']);
        Route::post('/appointments', [PosController::class, 'createAppointment']);
        Route::get('/availability/pooled', [PosController::class, 'availabilityPooled']);
        Route::get('/cancellation-requests', [PosController::class, 'posCancellationRequestsIndex']);
        Route::post('/cancellation-requests/{id}/approve', [PosController::class, 'posCancellationRequestApprove'])
            ->middleware('permission:booking.appointments.update_status');
        Route::post('/cancellation-requests/{id}/reject', [PosController::class, 'posCancellationRequestReject'])
            ->middleware('permission:booking.appointments.update_status');
        Route::get('/appointments/{id}', [PosController::class, 'appointmentDetail']);
        Route::post('/appointments/{id}/status', [PosController::class, 'updateAppointmentStatus']);
        Route::post('/appointments/{id}/collect-payment', [PosController::class, 'collectAppointmentPayment']);
        Route::post('/appointments/{id}/finalize-zero-settlement', [PosController::class, 'finalizeAppointmentZeroSettlement']);
        Route::post('/appointments/{id}/edit-settlement', [PosController::class, 'editAppointmentSettlement']);
        Route::get('/services/{serviceId}/addon-options', [PosController::class, 'getServiceAddonOptions']);
        Route::post('/appointments/{id}/apply-package', [PosController::class, 'applyPackageToAppointment']);
        Route::post('/appointments/{id}/release-package', [PosController::class, 'releasePackageForAppointment']);
        Route::post('/appointments/{id}/mark-completed', [PosController::class, 'markAppointmentCompleted']);
        Route::post('/appointments/{id}/reschedule', [PosController::class, 'rescheduleAppointment']);
        Route::post('/appointments/{id}/send-confirmation-email', [PosController::class, 'sendBookingConfirmationEmail'])
            ->middleware('throttle:6,1');
        Route::get('/cart', [PosController::class, 'cart']);
        Route::post('/book-service', [PosController::class, 'bookService']);
        Route::post('/cart/add-by-barcode', [PosController::class, 'addByBarcode']);
        Route::post('/cart/add-by-variant', [PosController::class, 'addByVariant']);
        Route::post('/cart/add-package', [PosController::class, 'addPackageToCart']);
        Route::post('/cart/add-appointment-settlement', [PosController::class, 'addAppointmentSettlementToCart']);
        Route::delete('/cart/appointment-settlements/{itemId}', [PosController::class, 'removeAppointmentSettlementCartItem']);
        Route::patch('/cart/package-items/{itemId}', [PosController::class, 'updatePackageCartItem']);
        Route::delete('/cart/package-items/{itemId}', [PosController::class, 'removePackageCartItem']);
        Route::post('/cart/add-service', [PosController::class, 'addService']);
        Route::post('/cart/sync-customer-context', [PosController::class, 'syncCustomerContext']);
        Route::post('/packages/purchase', [PosController::class, 'purchasePackage']);
        Route::post('/cart/voucher/apply', [PosController::class, 'applyVoucher']);
        Route::delete('/cart/voucher', [PosController::class, 'removeVoucher']);
        Route::patch('/cart/items/{itemId}', [PosController::class, 'updateCartItem']);
        Route::patch('/cart/items/{itemId}/discount', [PosController::class, 'updateCartItemDiscount']);
        Route::patch('/cart/package-items/{itemId}/discount', [PosController::class, 'updatePackageCartItemDiscount']);
        Route::patch('/cart/appointment-settlements/{itemId}/discount', [PosController::class, 'updateAppointmentSettlementCartItemDiscount']);
        Route::delete('/cart/items/{itemId}', [PosController::class, 'removeCartItem']);
        Route::delete('/cart/service-items/{itemId}', [PosController::class, 'removeServiceCartItem']);
        Route::post('/cart/service-items/{itemId}/release-package-claim', [PosController::class, 'releaseServiceItemPackageClaim']);
        Route::post('/checkout', [PosController::class, 'checkout']);
    });

    Route::post('/orders/{orderId}/send-receipt-email', [PosController::class, 'sendReceiptEmail'])
        ->middleware(['permission:pos.checkout', 'throttle:6,1']);

    // Ecommerce Admin APIs
    Route::prefix('ecommerce')->group(function () {
        // Categories
        Route::get('/categories', [CategoryController::class, 'index'])
            ->middleware('permission:ecommerce.categories.view|pos.checkout');

        Route::get('/categories/export', [CategoryController::class, 'exportCsv'])
            ->middleware('permission:ecommerce.categories.view');

        Route::post('/categories/import', [CategoryController::class, 'importCsv'])
            ->middleware('permission:ecommerce.categories.create');

        Route::post('/categories', [CategoryController::class, 'store'])
            ->middleware('permission:ecommerce.categories.create');

        Route::get('/categories/{category}', [CategoryController::class, 'show'])
            ->middleware('permission:ecommerce.categories.view');

        Route::put('/categories/{category}', [CategoryController::class, 'update'])
            ->middleware('permission:ecommerce.categories.update');

        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])
            ->middleware('permission:ecommerce.categories.delete');

        // Products
        Route::get('/products', [ProductController::class, 'index'])
            ->middleware('permission:ecommerce.products.view|pos.checkout');

        Route::get('/products/export', [ProductController::class, 'exportCsv'])
            ->middleware('permission:ecommerce.products.view');

        Route::post('/products/import', [ProductController::class, 'importCsv'])
            ->middleware('permission:ecommerce.products.create');

        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('permission:ecommerce.products.create');

        Route::put('/products/bulk', [ProductController::class, 'bulkUpdate'])
            ->middleware('permission:ecommerce.products.update');

        Route::get('/products/{product}', [ProductController::class, 'show'])
            ->middleware('permission:ecommerce.products.view|pos.checkout');

        Route::put('/products/{product}', [ProductController::class, 'update'])
            ->middleware('permission:ecommerce.products.update');

        Route::post('/products/{product}/stock-adjustment', [ProductController::class, 'adjustStock'])
            ->middleware('permission:ecommerce.products.update');

        Route::get('/product-stock-movements', [ProductStockMovementController::class, 'index'])
            ->middleware('permission:ecommerce.products.view');

        Route::delete('/products/{product}', [ProductController::class, 'destroy'])
            ->middleware('permission:ecommerce.products.delete');

        Route::post('/products/{product}/media', [ProductMediaController::class, 'store'])
            ->middleware('permission:ecommerce.products.update');

        Route::delete('/products/{product}/media/{media}', [ProductMediaController::class, 'destroy'])
            ->middleware('permission:ecommerce.products.update')
            ->scopeBindings();

        Route::put('/products/{product}/media/reorder', [ProductMediaController::class, 'reorder'])
            ->middleware('permission:ecommerce.products.update');

        Route::get('/product-variants/{variant}/bundle-items', [ProductVariantBundleItemController::class, 'index'])
            ->middleware('permission:ecommerce.products.update');

        Route::put('/product-variants/{variant}/bundle-items', [ProductVariantBundleItemController::class, 'update'])
            ->middleware('permission:ecommerce.products.update');

        // Shop Menu Items
        Route::get('/shop-menu-items', [ShopMenuItemController::class, 'index'])
            ->middleware('permission:ecommerce.shop-menu.view');

        Route::get('/shop-menu-items/export', [ShopMenuItemController::class, 'exportCsv'])
            ->middleware('permission:ecommerce.shop-menu.view');

        Route::post('/shop-menu-items/import', [ShopMenuItemController::class, 'importCsv'])
            ->middleware('permission:ecommerce.shop-menu.create');

        Route::post('/shop-menu-items', [ShopMenuItemController::class, 'store'])
            ->middleware('permission:ecommerce.shop-menu.create');

        Route::get('/shop-menu-items/{shopMenuItem}', [ShopMenuItemController::class, 'show'])
            ->middleware('permission:ecommerce.shop-menu.view');

        Route::put('/shop-menu-items/{shopMenuItem}', [ShopMenuItemController::class, 'update'])
            ->middleware('permission:ecommerce.shop-menu.update');

        Route::delete('/shop-menu-items/{shopMenuItem}', [ShopMenuItemController::class, 'destroy'])
            ->middleware('permission:ecommerce.shop-menu.delete');

        Route::post('/shop-menu-items/{shopMenuItem}/move-up', [ShopMenuItemController::class, 'moveUp'])
            ->middleware('permission:ecommerce.shop-menu.update');

        Route::post('/shop-menu-items/{shopMenuItem}/move-down', [ShopMenuItemController::class, 'moveDown'])
            ->middleware('permission:ecommerce.shop-menu.update');

        // Services Menu Items
        Route::get('/services-menu-items', [ServicesMenuItemController::class, 'index'])
            ->middleware('permission:ecommerce.services-menu.view');

        Route::post('/services-menu-items', [ServicesMenuItemController::class, 'store'])
            ->middleware('permission:ecommerce.services-menu.create');

        Route::get('/services-menu-items/{servicesMenuItem}', [ServicesMenuItemController::class, 'show'])
            ->middleware('permission:ecommerce.services-menu.view');

        Route::put('/services-menu-items/{servicesMenuItem}', [ServicesMenuItemController::class, 'update'])
            ->middleware('permission:ecommerce.services-menu.update');

        Route::delete('/services-menu-items/{servicesMenuItem}', [ServicesMenuItemController::class, 'destroy'])
            ->middleware('permission:ecommerce.services-menu.delete');

        Route::post('/services-menu-items/{servicesMenuItem}/move-up', [ServicesMenuItemController::class, 'moveUp'])
            ->middleware('permission:ecommerce.services-menu.update');

        Route::post('/services-menu-items/{servicesMenuItem}/move-down', [ServicesMenuItemController::class, 'moveDown'])
            ->middleware('permission:ecommerce.services-menu.update');

        // Services Pages
        Route::get('/services-pages', [ServicesPageController::class, 'index'])
            ->middleware('permission:ecommerce.services-pages.view');

        Route::get('/services-pages/preview-config', [ServicesPageController::class, 'previewConfig'])
            ->middleware('permission:ecommerce.services-pages.preview');

        Route::get('/services-pages/{servicesMenuItem}', [ServicesPageController::class, 'show'])
            ->middleware('permission:ecommerce.services-pages.view');

        Route::put('/services-pages/{servicesMenuItem}', [ServicesPageController::class, 'upsert'])
            ->middleware('permission:ecommerce.services-pages.update');

        Route::delete('/services-pages/{servicesMenuItem}', [ServicesPageController::class, 'destroy'])
            ->middleware('permission:ecommerce.services-pages.delete');

        // Store Locations
        Route::get('/store-locations', [StoreLocationController::class, 'index'])
            ->middleware('permission:ecommerce.stores.view');

        Route::post('/store-locations', [StoreLocationController::class, 'store'])
            ->middleware('permission:ecommerce.stores.create');

        Route::get('/store-locations/{storeLocation}', [StoreLocationController::class, 'show'])
            ->middleware('permission:ecommerce.stores.view');

        Route::put('/store-locations/{storeLocation}', [StoreLocationController::class, 'update'])
            ->middleware('permission:ecommerce.stores.update');

        Route::delete('/store-locations/{storeLocation}', [StoreLocationController::class, 'destroy'])
            ->middleware('permission:ecommerce.stores.delete');

        // Bank Accounts Admin
        Route::get('/bank-accounts', [BankAccountController::class, 'index'])
            ->middleware('permission:ecommerce.bank-accounts.view');

        Route::post('/bank-accounts', [BankAccountController::class, 'store'])
            ->middleware('permission:ecommerce.bank-accounts.create');

        Route::get('/bank-accounts/{bankAccount}', [BankAccountController::class, 'show'])
            ->middleware('permission:ecommerce.bank-accounts.view');

        Route::put('/bank-accounts/{bankAccount}', [BankAccountController::class, 'update'])
            ->middleware('permission:ecommerce.bank-accounts.update');

        Route::post('/bank-accounts/{bankAccount}', [BankAccountController::class, 'update'])
            ->middleware('permission:ecommerce.bank-accounts.update');

        Route::post('/bank-accounts/{bankAccount}/move-up', [BankAccountController::class, 'moveUp'])
            ->middleware('permission:ecommerce.bank-accounts.update');

        Route::post('/bank-accounts/{bankAccount}/move-down', [BankAccountController::class, 'moveDown'])
            ->middleware('permission:ecommerce.bank-accounts.update');

        Route::delete('/bank-accounts/{bankAccount}', [BankAccountController::class, 'destroy'])
            ->middleware('permission:ecommerce.bank-accounts.delete');

        // Payment Gateways Admin
        Route::get('/payment-gateways', [PaymentGatewayController::class, 'index'])
            ->middleware('permission:ecommerce.payment-gateways.view');

        Route::post('/payment-gateways', [PaymentGatewayController::class, 'store'])
            ->middleware('permission:ecommerce.payment-gateways.create');

        Route::get('/payment-gateways/{paymentGateway}', [PaymentGatewayController::class, 'show'])
            ->middleware('permission:ecommerce.payment-gateways.view');

        Route::put('/payment-gateways/{paymentGateway}', [PaymentGatewayController::class, 'update'])
            ->middleware('permission:ecommerce.payment-gateways.update');

        Route::post('/payment-gateways/{paymentGateway}', [PaymentGatewayController::class, 'update'])
            ->middleware('permission:ecommerce.payment-gateways.update');

        Route::post('/payment-gateways/{paymentGateway}/move-up', [PaymentGatewayController::class, 'moveUp'])
            ->middleware('permission:ecommerce.payment-gateways.update');

        Route::post('/payment-gateways/{paymentGateway}/move-down', [PaymentGatewayController::class, 'moveDown'])
            ->middleware('permission:ecommerce.payment-gateways.update');

        Route::delete('/payment-gateways/{paymentGateway}', [PaymentGatewayController::class, 'destroy'])
            ->middleware('permission:ecommerce.payment-gateways.delete');

        Route::get('/billplz-payment-gateway-options', [BillplzPaymentGatewayOptionController::class, 'index'])
            ->middleware('permission:ecommerce.payment-gateways.view');
        Route::post('/billplz-payment-gateway-options', [BillplzPaymentGatewayOptionController::class, 'store'])
            ->middleware('permission:ecommerce.payment-gateways.create');
        Route::get('/billplz-payment-gateway-options/{paymentGatewayOption}', [BillplzPaymentGatewayOptionController::class, 'show'])
            ->middleware('permission:ecommerce.payment-gateways.view');
        Route::put('/billplz-payment-gateway-options/{paymentGatewayOption}', [BillplzPaymentGatewayOptionController::class, 'update'])
            ->middleware('permission:ecommerce.payment-gateways.update');
        Route::post('/billplz-payment-gateway-options/{paymentGatewayOption}', [BillplzPaymentGatewayOptionController::class, 'update'])
            ->middleware('permission:ecommerce.payment-gateways.update');
        Route::delete('/billplz-payment-gateway-options/{paymentGatewayOption}', [BillplzPaymentGatewayOptionController::class, 'destroy'])
            ->middleware('permission:ecommerce.payment-gateways.delete');

        Route::post('/cart/merge', [CartMergeController::class, 'merge'])
            ->middleware('permission:ecommerce.carts.merge');

        // Customers Admin
        Route::get('/customers', [EcommerceCustomerController::class, 'index'])
            ->middleware('permission:ecommerce.customers.view');

        Route::post('/customers', [EcommerceCustomerController::class, 'store'])
            ->middleware('permission:ecommerce.customers.create');

        Route::get('/customers/{customer}', [EcommerceCustomerController::class, 'show'])
            ->middleware('permission:ecommerce.customers.view');

        Route::put('/customers/{customer}', [EcommerceCustomerController::class, 'update'])
            ->middleware('permission:ecommerce.customers.update');

        Route::delete('/customers/{customer}', [EcommerceCustomerController::class, 'destroy'])
            ->middleware('permission:ecommerce.customers.delete');

        // Orders Admin
        Route::get('/orders', [OrderController::class, 'index'])
            ->middleware('permission:ecommerce.orders.view');

        Route::get('/orders/{order}', [OrderController::class, 'show'])
            ->middleware('permission:ecommerce.orders.view');
        Route::get('/orders/{order}/invoice', [OrderController::class, 'invoice'])
            ->middleware('permission:ecommerce.orders.view');

        Route::put('/orders/{order}', [OrderController::class, 'update'])
            ->middleware('permission:ecommerce.orders.update');


        Route::put('/orders/{order}/confirm-payment', [OrderController::class, 'confirmPayment'])
            ->middleware('permission:ecommerce.orders.confirm-payment');

        Route::put('/orders/{order}/reject-payment-proof', [OrderController::class, 'RejectPaymentProof'])
            ->middleware('permission:ecommerce.orders.update');

        Route::put('/orders/{order}/cancel-order', [OrderController::class, 'cancelOrder'])
            ->middleware('permission:ecommerce.orders.update');

        Route::get('/orders/{order}/offline-actions/sales-person', [OfflineOrderManagementController::class, 'salesPersonDraft'])
            ->middleware('permission:ecommerce.orders.update');

        Route::put('/orders/{order}/offline-actions/sales-person', [OfflineOrderManagementController::class, 'updateSalesPerson'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/offline-actions/sales-person', [OfflineOrderManagementController::class, 'updateSalesPerson'])
            ->middleware('permission:ecommerce.orders.update');

        Route::get('/orders/{order}/offline-actions/booking-worker', [OfflineOrderManagementController::class, 'bookingWorkerDraft'])
            ->middleware('permission:ecommerce.orders.update');
        Route::put('/orders/{order}/offline-actions/booking-worker', [OfflineOrderManagementController::class, 'updateBookingWorker'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/offline-actions/booking-worker', [OfflineOrderManagementController::class, 'updateBookingWorker'])
            ->middleware('permission:ecommerce.orders.update');

        Route::put('/orders/{order}/offline-actions/payment-method', [OfflineOrderManagementController::class, 'updatePaymentMethod'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/offline-actions/payment-method', [OfflineOrderManagementController::class, 'updatePaymentMethod'])
            ->middleware('permission:ecommerce.orders.update');

        Route::put('/orders/{order}/offline-actions/void', [OfflineOrderManagementController::class, 'voidOrder'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/offline-actions/void', [OfflineOrderManagementController::class, 'voidOrder'])
            ->middleware('permission:ecommerce.orders.update');

        Route::put('/orders/{order}/refund', [OrderController::class, 'refund'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/refund', [OrderController::class, 'refund'])
            ->middleware('permission:ecommerce.orders.update');
        Route::post('/orders/{order}/complete', [OrderController::class, 'complete'])
            ->middleware('permission:ecommerce.orders.update');

        Route::get('/returns', [ReturnRequestController::class, 'index'])
            ->middleware('permission:ecommerce.returns.view');

        Route::get('/returns/{returnRequest}', [ReturnRequestController::class, 'show'])
            ->middleware('permission:ecommerce.returns.view');

        Route::put('/returns/{returnRequest}/status', [ReturnRequestController::class, 'updateStatus'])
            ->middleware('permission:ecommerce.returns.update');

        // Voucher Admin
        Route::get('/vouchers', [VoucherController::class, 'index'])
            ->middleware('permission:ecommerce.vouchers.view|pos.checkout');

        Route::get('/vouchers/assignable', [VoucherController::class, 'assignable'])
            ->middleware('permission:ecommerce.vouchers.assign');

        Route::get('/vouchers/assign-logs', [VoucherAssignLogController::class, 'index'])
            ->middleware('permission:ecommerce.vouchers.assign.logs.view');

        Route::post('/vouchers', [VoucherController::class, 'store'])
            ->middleware('permission:ecommerce.vouchers.create');

        Route::get('/vouchers/{voucher}', [VoucherController::class, 'show'])
            ->middleware('permission:ecommerce.vouchers.view');

        Route::put('/vouchers/{voucher}', [VoucherController::class, 'update'])
            ->middleware('permission:ecommerce.vouchers.update');

        Route::delete('/vouchers/{voucher}', [VoucherController::class, 'destroy'])
            ->middleware('permission:ecommerce.vouchers.delete');

        Route::post('/customers/{customer}/vouchers/assign', [EcommerceCustomerController::class, 'assignVoucher'])
            ->middleware('permission:ecommerce.vouchers.assign');

        Route::get('/customers/{customer}/voucher-assign-logs', [VoucherAssignLogController::class, 'customerLogs'])
            ->middleware('permission:ecommerce.vouchers.assign.logs.view');

        // SEO Global
        Route::get('/seo-global', [SeoGlobalController::class, 'show']);

        Route::post('/seo-global/upload-image', [SeoGlobalController::class, 'uploadImage']);

        Route::put('/seo-global', [SeoGlobalController::class, 'update']);

        // Loyalty Settings
        Route::get('/loyalty-settings', [LoyaltySettingController::class, 'index'])
            ->middleware('permission:ecommerce.loyalty.settings.view');

        Route::post('/loyalty-settings', [LoyaltySettingController::class, 'store'])
            ->middleware('permission:ecommerce.loyalty.settings.create');

        Route::get('/loyalty-settings/{loyaltySetting}', [LoyaltySettingController::class, 'show'])
            ->middleware('permission:ecommerce.loyalty.settings.view');

        Route::put('/loyalty-settings/{loyaltySetting}', [LoyaltySettingController::class, 'update'])
            ->middleware('permission:ecommerce.loyalty.settings.update');

        Route::delete('/loyalty-settings/{loyaltySetting}', [LoyaltySettingController::class, 'destroy'])
            ->middleware('permission:ecommerce.loyalty.settings.delete');

        // Membership Tier Rules
        Route::get('/membership-tiers', [MembershipTierRuleController::class, 'index'])
            ->middleware('permission:ecommerce.loyalty.tiers.view');

        Route::post('/membership-tiers', [MembershipTierRuleController::class, 'store'])
            ->middleware('permission:ecommerce.loyalty.tiers.edit');

        Route::get('/membership-tiers/{membershipTierRule}', [MembershipTierRuleController::class, 'show'])
            ->middleware('permission:ecommerce.loyalty.tiers.view');

        Route::put('/membership-tiers/{membershipTierRule}', [MembershipTierRuleController::class, 'update'])
            ->middleware('permission:ecommerce.loyalty.tiers.update');

        Route::delete('/membership-tiers/{membershipTierRule}', [MembershipTierRuleController::class, 'destroy'])
            ->middleware('permission:ecommerce.loyalty.tiers.delete');

        Route::post('/membership-tiers/{membershipTierRule}/move-up', [MembershipTierRuleController::class, 'moveUp'])
            ->middleware('permission:ecommerce.loyalty.tiers.update');

        Route::post('/membership-tiers/{membershipTierRule}/move-down', [MembershipTierRuleController::class, 'moveDown'])
            ->middleware('permission:ecommerce.loyalty.tiers.update');

        Route::get('/customers/{customer}/loyalty-summary', [LoyaltyAdminController::class, 'summary'])
            ->middleware('permission:ecommerce.customers.view');

        Route::get('/customers/{customer}/loyalty-history', [LoyaltyAdminController::class, 'history'])
            ->middleware('permission:ecommerce.customers.view');

        Route::get('/loyalty/rewards', [LoyaltyRewardController::class, 'index'])
            ->middleware('permission:ecommerce.loyalty.rewards.view');

        Route::post('/loyalty/rewards', [LoyaltyRewardController::class, 'store'])
            ->middleware('permission:ecommerce.loyalty.rewards.create');

        Route::get('/loyalty/rewards/{reward}', [LoyaltyRewardController::class, 'show'])
            ->middleware('permission:ecommerce.loyalty.rewards.view');

        Route::put('/loyalty/rewards/{reward}', [LoyaltyRewardController::class, 'update'])
            ->middleware('permission:ecommerce.loyalty.rewards.update');

        Route::delete('/loyalty/rewards/{reward}', [LoyaltyRewardController::class, 'destroy'])
            ->middleware('permission:ecommerce.loyalty.rewards.delete');

        Route::get('/loyalty/redemptions', [LoyaltyRedemptionAdminController::class, 'index'])
            ->middleware('permission:ecommerce.loyalty.redemptions.view');

        Route::get('/loyalty/redemptions/{redemption}', [LoyaltyRedemptionAdminController::class, 'show'])
            ->middleware('permission:ecommerce.loyalty.redemptions.view');

        Route::put('/loyalty/redemptions/{redemption}/status', [LoyaltyRedemptionAdminController::class, 'updateStatus'])
            ->middleware('permission:ecommerce.loyalty.redemptions.update');

        // Shop Settings
        Route::get('/shop-settings', [ShopSettingController::class, 'index']);

        Route::get('/shop-settings/{key}', [ShopSettingController::class, 'show']);

        Route::put('/shop-settings/{key}', [ShopSettingController::class, 'update']);

        // Branding (logos)
        Route::get('/branding', [BrandingController::class, 'show']);

        Route::post('/branding/shop-logo', [BrandingController::class, 'uploadShopLogo']);

        Route::post('/branding/crm-logo', [BrandingController::class, 'uploadCrmLogo']);

        Route::post('/branding/shop-favicon', [BrandingController::class, 'uploadShopFavicon']);

        Route::post('/branding/crm-favicon', [BrandingController::class, 'uploadCrmFavicon']);

        // Promotions Admin
        Route::get('/promotions', [PromotionController::class, 'index'])
            ->middleware('permission:ecommerce.promotions.view');

        Route::post('/promotions', [PromotionController::class, 'store'])
            ->middleware('permission:ecommerce.promotions.create');

        Route::get('/promotions/{promotion}', [PromotionController::class, 'show'])
            ->middleware('permission:ecommerce.promotions.view');

        Route::put('/promotions/{promotion}', [PromotionController::class, 'update'])
            ->middleware('permission:ecommerce.promotions.update');

        Route::delete('/promotions/{promotion}', [PromotionController::class, 'destroy'])
            ->middleware('permission:ecommerce.promotions.delete');

        Route::get('/promotions-product-options', [PromotionController::class, 'productOptions'])
            ->middleware('permission:ecommerce.promotions.view');

        // Announcements Admin
        Route::get('/announcements', [AnnouncementController::class, 'index'])
            ->middleware('permission:ecommerce.announcements.view');

        Route::post('/announcements', [AnnouncementController::class, 'store'])
            ->middleware('permission:ecommerce.announcements.create');

        Route::get('/announcements/{announcement}', [AnnouncementController::class, 'show'])
            ->middleware('permission:ecommerce.announcements.view');

        Route::put('/announcements/{announcement}', [AnnouncementController::class, 'update'])
            ->middleware('permission:ecommerce.announcements.update');

        Route::delete('/announcements/{announcement}', [AnnouncementController::class, 'destroy'])
            ->middleware('permission:ecommerce.announcements.delete');

        Route::post('/announcements/{announcement}/move-up', [AnnouncementController::class, 'moveUp'])
            ->middleware('permission:ecommerce.announcements.update');

        Route::post('/announcements/{announcement}/move-down', [AnnouncementController::class, 'moveDown'])
            ->middleware('permission:ecommerce.announcements.update');

        // Home Sliders Admin
        Route::get('/home-sliders', [HomeSliderController::class, 'index'])
            ->middleware('permission:ecommerce.sliders.view');

        Route::post('/home-sliders', [HomeSliderController::class, 'store'])
            ->middleware('permission:ecommerce.sliders.create');

        Route::get('/home-sliders/{slider}', [HomeSliderController::class, 'show'])
            ->middleware('permission:ecommerce.sliders.view');

        Route::put('/home-sliders/{slider}', [HomeSliderController::class, 'update'])
            ->middleware('permission:ecommerce.sliders.update');

        Route::delete('/home-sliders/{slider}', [HomeSliderController::class, 'destroy'])
            ->middleware('permission:ecommerce.sliders.delete');

        Route::post('/home-sliders/{slider}/move-up', [HomeSliderController::class, 'moveUp'])
            ->middleware('permission:ecommerce.sliders.update');

        Route::post('/home-sliders/{slider}/move-down', [HomeSliderController::class, 'moveDown'])
            ->middleware('permission:ecommerce.sliders.update');

        // Marquees Admin
        Route::get('/marquees', [MarqueeController::class, 'index'])
            ->middleware('permission:ecommerce.marquees.view');

        Route::post('/marquees', [MarqueeController::class, 'store'])
            ->middleware('permission:ecommerce.marquees.create');

        Route::get('/marquees/{marquee}', [MarqueeController::class, 'show'])
            ->middleware('permission:ecommerce.marquees.view');

        Route::put('/marquees/{marquee}', [MarqueeController::class, 'update'])
            ->middleware('permission:ecommerce.marquees.update');

        Route::delete('/marquees/{marquee}', [MarqueeController::class, 'destroy'])
            ->middleware('permission:ecommerce.marquees.delete');

        Route::post('/marquees/{marquee}/move-up', [MarqueeController::class, 'moveUp'])
            ->middleware('permission:ecommerce.marquees.update');

        Route::post('/marquees/{marquee}/move-down', [MarqueeController::class, 'moveDown'])
            ->middleware('permission:ecommerce.marquees.update');

        // Notification Templates
        Route::get('/notification-templates', [NotificationTemplateController::class, 'index'])
            ->middleware('permission:ecommerce.notifications.templates.view');

        Route::post('/notification-templates', [NotificationTemplateController::class, 'store'])
            ->middleware('permission:ecommerce.notifications.templates.create');

        Route::get('/notification-templates/{notificationTemplate}', [NotificationTemplateController::class, 'show'])
            ->middleware('permission:ecommerce.notifications.templates.view');

        Route::put('/notification-templates/{notificationTemplate}', [NotificationTemplateController::class, 'update'])
            ->middleware('permission:ecommerce.notifications.templates.update');

        Route::delete('/notification-templates/{notificationTemplate}', [NotificationTemplateController::class, 'destroy'])
            ->middleware('permission:ecommerce.notifications.templates.delete');

        Route::get('/dashboard/overview', [DashboardController::class, 'overview'])
            ->middleware('permission:ecommerce.dashboard.view');

        Route::prefix('reports')->group(function () {
            Route::get('/sales/overview', [SalesReportController::class, 'overview'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/daily', [SalesReportController::class, 'daily'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/by-category', [SalesReportController::class, 'byCategory'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/by-products', [SalesReportController::class, 'byProducts'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/by-customers', [SalesReportController::class, 'byCustomers'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/ecommerce', [SalesChannelReportController::class, 'ecommerce'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/booking', [SalesChannelReportController::class, 'booking'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/visual-daily/ecommerce', [SalesChannelReportController::class, 'visualDailyEcommerce'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/visual-daily/booking', [SalesChannelReportController::class, 'visualDailyBooking'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/visual-daily/all', [SalesChannelReportController::class, 'visualDailyAll'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/customers-ecommerce', [CustomerSalesDomainReportController::class, 'ecommerce'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/sales/customers-booking', [CustomerSalesDomainReportController::class, 'booking'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/staff-commission', [StaffCommissionReportController::class, 'summary'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/staff-commission/detail', [StaffCommissionReportController::class, 'detail'])
                ->middleware('permission:ecommerce.reports.sales.view');

            Route::get('/my-pos-summary', [MyPosSummaryReportController::class, 'index'])
                ->middleware('permission:reports.my-pos-summary.view');

            Route::get('/pos-summary', [PosSummaryReportController::class, 'index'])
                ->middleware('permission:reports.pos-summary.view');

            Route::prefix('sales')->group(function () {
                Route::get('/export/overview', [SalesReportExportController::class, 'overview'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/daily', [SalesReportExportController::class, 'daily'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/by-category', [SalesReportExportController::class, 'byCategory'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/by-products', [SalesReportExportController::class, 'byProducts'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/by-customers', [SalesReportExportController::class, 'byCustomers'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/ecommerce', [SalesChannelReportController::class, 'exportEcommerce'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/booking', [SalesChannelReportController::class, 'exportBooking'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/customers-ecommerce', [CustomerSalesDomainReportController::class, 'exportEcommerce'])
                    ->middleware('permission:ecommerce.reports.sales.export');

                Route::get('/export/customers-booking', [CustomerSalesDomainReportController::class, 'exportBooking'])
                    ->middleware('permission:ecommerce.reports.sales.export');
            });
        });
    });
};

// 🟢 Session + Sanctum token 共用一套受保护路由（Cookie 或 Bearer token 都可）
Route::middleware(['api.session', 'auth:web,sanctum'])->group($protectedRoutes);

Route::prefix('/booking')->middleware('api.session')->group(function () {
    Route::get('/landing-page', [\App\Http\Controllers\Booking\LandingPageController::class, 'show']);
    Route::get('/service-categories', [\App\Http\Controllers\Booking\ServiceController::class, 'categories']);
    Route::get('/services', [\App\Http\Controllers\Booking\ServiceController::class, 'index']);
    Route::get('/services/{id}', [\App\Http\Controllers\Booking\ServiceController::class, 'show']);
    Route::get('/service-packages', [\App\Http\Controllers\ServicePackageController::class, 'index']);
    Route::get('/customers/{id}/service-package-available-for/{serviceId}', [CustomerServicePackageController::class, 'availableFor']);
    Route::get('/availability/pooled', [\App\Http\Controllers\Booking\AvailabilityController::class, 'pooled']);
    Route::get('/availability', [\App\Http\Controllers\Booking\AvailabilityController::class, 'index']);
    Route::get('/availability/bulk', [\App\Http\Controllers\Booking\AvailabilityController::class, 'bulk']);
    Route::post('/hold', [\App\Http\Controllers\Booking\HoldController::class, 'store']);
    Route::get('/cart', [\App\Http\Controllers\Booking\CartController::class, 'show']);
    Route::post('/cart/add', [\App\Http\Controllers\Booking\CartController::class, 'add']);
    Route::delete('/cart/item/{itemId}', [\App\Http\Controllers\Booking\CartController::class, 'removeItem']);
    Route::post('/cart/item/{itemId}/release-package-claim', [\App\Http\Controllers\Booking\CartController::class, 'releasePackageClaim']);
    Route::post('/cart/checkout', [\App\Http\Controllers\Booking\CartController::class, 'checkout']);
    Route::post('/{id}/pay', [\App\Http\Controllers\Booking\PaymentController::class, 'pay']);
    Route::post('/payment/callback', [\App\Http\Controllers\Booking\PaymentController::class, 'callback']);

    Route::middleware('auth:customer,sanctum')->group(function () {
        Route::post('/cart/add-package', [\App\Http\Controllers\Booking\CartController::class, 'addPackage']);
        Route::patch('/cart/package-item/{itemId}', [\App\Http\Controllers\Booking\CartController::class, 'updatePackageItem']);
        Route::delete('/cart/package-item/{itemId}', [\App\Http\Controllers\Booking\CartController::class, 'removePackageItem']);
        Route::get('/my', [\App\Http\Controllers\Booking\MyBookingController::class, 'index']);
        Route::get('/{id}/payment-detail', [\App\Http\Controllers\Booking\PaymentController::class, 'detail']);
        Route::post('/{id}/upload-slip', [\App\Http\Controllers\Booking\PaymentController::class, 'uploadSlip']);
        Route::post('/{id}/reschedule', [\App\Http\Controllers\Booking\RescheduleController::class, 'store']);
        Route::post('/{id}/cancellation-request', [\App\Http\Controllers\Booking\CancellationRequestController::class, 'store']);
        Route::get('/cancellation-requests/my', [\App\Http\Controllers\Booking\CancellationRequestController::class, 'my']);
        Route::get('/my/service-packages', [\App\Http\Controllers\Booking\ServicePackageCustomerController::class, 'index']);
        Route::post('/service-packages/purchase', [\App\Http\Controllers\Booking\ServicePackageCustomerController::class, 'purchase']);
    });
});

Route::middleware(['api.session', 'auth:web,sanctum'])->prefix('/booking/my-leave')->group(function () {
    Route::get('/balances', [\App\Http\Controllers\Booking\MyLeaveController::class, 'indexBalances']);
    Route::get('/requests', [\App\Http\Controllers\Booking\MyLeaveController::class, 'indexRequests']);
    Route::post('/requests', [\App\Http\Controllers\Booking\MyLeaveController::class, 'store']);
    Route::patch('/requests/{id}/cancel', [\App\Http\Controllers\Booking\MyLeaveController::class, 'cancel']);
});

Route::middleware(['api.session', 'auth:web,sanctum'])->prefix('/admin/booking')->group(function () {
    Route::get('/landing-page', [\App\Http\Controllers\Booking\LandingPageController::class, 'adminShow'])
        ->middleware('permission:booking.landing-page.view');
    Route::put('/landing-page', [\App\Http\Controllers\Booking\LandingPageController::class, 'update'])
        ->middleware('permission:booking.landing-page.update');
    Route::post('/landing-page/upload-image', [\App\Http\Controllers\Booking\LandingPageController::class, 'uploadImage'])
        ->middleware('permission:booking.landing-page.update');

    Route::get('/appointments', [\App\Http\Controllers\Admin\Booking\AppointmentController::class, 'index']);
    Route::get('/appointments/{id}', [\App\Http\Controllers\Admin\Booking\AppointmentController::class, 'show']);
    Route::patch('/appointments/{id}/status', [\App\Http\Controllers\Admin\Booking\AppointmentController::class, 'updateStatus']);
    Route::post('/appointments/{id}/photos', [\App\Http\Controllers\Admin\Booking\AppointmentController::class, 'uploadPhoto']);
    Route::post('/{id}/reschedule', [\App\Http\Controllers\Admin\Booking\RescheduleController::class, 'store']);

    Route::get('/reports/staff', [\App\Http\Controllers\Admin\Booking\ReportController::class, 'staff']);
    Route::get('/reports/staff/export.csv', [\App\Http\Controllers\Admin\Booking\ReportController::class, 'staffExport']);
    Route::get('/reports/summary', [\App\Http\Controllers\Admin\Booking\ReportController::class, 'summary']);
    Route::get('/reports/summary/export.csv', [\App\Http\Controllers\Admin\Booking\ReportController::class, 'summaryExport']);

    Route::get('/logs', [\App\Http\Controllers\Admin\Booking\LogController::class, 'index']);
    Route::get('/logs/export.csv', [\App\Http\Controllers\Admin\Booking\LogController::class, 'export']);


    Route::get('/cancellation-requests', [\App\Http\Controllers\Admin\Booking\CancellationRequestController::class, 'index']);
    Route::get('/cancellation-requests/{id}', [\App\Http\Controllers\Admin\Booking\CancellationRequestController::class, 'show']);
    Route::post('/cancellation-requests/{id}/approve', [\App\Http\Controllers\Admin\Booking\CancellationRequestController::class, 'approve']);
    Route::post('/cancellation-requests/{id}/reject', [\App\Http\Controllers\Admin\Booking\CancellationRequestController::class, 'reject']);

    Route::get('/settings/notified-cancellation-voucher', [\App\Http\Controllers\Admin\Booking\SettingController::class, 'show']);
    Route::put('/settings/notified-cancellation-voucher', [\App\Http\Controllers\Admin\Booking\SettingController::class, 'update']);

    Route::get('/services/export', [\App\Http\Controllers\Admin\Booking\ServiceController::class, 'exportCsv'])
        ->middleware('permission:booking.services.view');
    Route::post('/services/import', [\App\Http\Controllers\Admin\Booking\ServiceController::class, 'importCsv'])
        ->middleware('permission:booking.services.create|booking.services.update');
    Route::apiResource('/services', \App\Http\Controllers\Admin\Booking\ServiceController::class);
    Route::get('/categories/export', [\App\Http\Controllers\Admin\Booking\CategoryController::class, 'exportCsv'])
        ->middleware('permission:booking.services.view');
    Route::post('/categories/import', [\App\Http\Controllers\Admin\Booking\CategoryController::class, 'importCsv'])
        ->middleware('permission:booking.services.create|booking.services.update');
    Route::apiResource('/categories', \App\Http\Controllers\Admin\Booking\CategoryController::class);
    Route::post('/categories/{id}/move-up', [\App\Http\Controllers\Admin\Booking\CategoryController::class, 'moveUp']);
    Route::post('/categories/{id}/move-down', [\App\Http\Controllers\Admin\Booking\CategoryController::class, 'moveDown']);
    Route::put('/staff-schedules/bulk', [\App\Http\Controllers\Admin\Booking\StaffScheduleController::class, 'bulkUpdate']);
    Route::get('/staff-schedules/export', [\App\Http\Controllers\Admin\Booking\StaffScheduleController::class, 'exportCsv'])
        ->middleware('permission:booking.schedules.view');
    Route::post('/staff-schedules/import', [\App\Http\Controllers\Admin\Booking\StaffScheduleController::class, 'importCsv'])
        ->middleware('permission:booking.schedules.create|booking.schedules.update');
    Route::apiResource('/staff-schedules', \App\Http\Controllers\Admin\Booking\StaffScheduleController::class);
    Route::get('/leave-requests', [\App\Http\Controllers\Admin\Booking\LeaveRequestController::class, 'index'])
        ->middleware('permission:booking.schedules.view');
    Route::patch('/leave-requests/{id}/decision', [\App\Http\Controllers\Admin\Booking\LeaveRequestController::class, 'decide'])
        ->middleware('permission:booking.schedules.update');
    Route::post('/off-days', [\App\Http\Controllers\Admin\Booking\LeaveRequestController::class, 'storeOffDay'])
        ->middleware('permission:booking.schedules.update');
    Route::get('/leave-balances', [\App\Http\Controllers\Admin\Booking\LeaveBalanceController::class, 'index'])
        ->middleware('permission:booking.schedules.view');
    Route::put('/leave-balances/{staffId}', [\App\Http\Controllers\Admin\Booking\LeaveBalanceController::class, 'upsert'])
        ->middleware('permission:booking.schedules.update');
    Route::patch('/leave-balances/{staffId}/adjust', [\App\Http\Controllers\Admin\Booking\LeaveBalanceController::class, 'adjust'])
        ->middleware('permission:booking.schedules.update');
    Route::get('/leave-logs', [\App\Http\Controllers\Admin\Booking\LeaveLogController::class, 'index'])
        ->middleware('permission:booking.leave.logs.view');
    Route::apiResource('/blocks', \App\Http\Controllers\Admin\Booking\BlockController::class);
    Route::apiResource('/commission-tiers', \App\Http\Controllers\Admin\Booking\CommissionTierController::class)
        ->only(['index', 'store', 'update', 'destroy']);
    Route::get('/commissions', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'index']);
    Route::get('/commission-logs', [\App\Http\Controllers\Admin\Booking\CommissionLogController::class, 'index']);
    Route::patch('/commissions/freeze-month', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'freezeMonth']);
    Route::patch('/commissions/reopen-month', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'reopenMonth']);
    Route::patch('/commissions/{id}/override', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'override']);
    Route::patch('/commissions/{id}/freeze', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'freeze']);
    Route::patch('/commissions/{id}/reopen', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'reopen']);
    Route::post('/commissions/recalculate', [\App\Http\Controllers\Admin\Booking\CommissionController::class, 'recalculate']);
});
