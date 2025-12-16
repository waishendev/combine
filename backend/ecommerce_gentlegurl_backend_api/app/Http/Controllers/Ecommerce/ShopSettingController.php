<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\SettingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class ShopSettingController extends Controller
{
    /**
     * 返回当前支持的所有 shop 设置
     * GET /api/ecommerce/shop-settings
     */
    public function index()
    {
        $data = [
            'shop_contact_widget' => SettingService::get('shop_contact_widget', SettingService::defaultValue('shop_contact_widget')),
            'homepage_products' => SettingService::get('homepage_products', SettingService::defaultValue('homepage_products')),
            'shipping' => SettingService::get('shipping', SettingService::defaultValue('shipping')),
            'footer' => SettingService::get('footer', SettingService::defaultValue('footer')),
        ];

        return response()->json([
            'data' => $data,
            'message' => null,
            'success' => true,
        ]);
    }

    /**
     * 单个 key 读取
     * GET /api/ecommerce/shop-settings/{key}
     *
     * 支持的 key：
     * - shop_contact_widget
     * - homepage_products
     */
    public function show(string $key)
    {
        if (! in_array($key, ['shop_contact_widget', 'homepage_products', 'shipping', 'footer'], true)) {
            return response()->json([
                'data' => null,
                'message' => 'Setting key not supported.',
                'success' => false,
            ], 404);
        }

        $value = SettingService::get($key, SettingService::defaultValue($key));

        return response()->json([
            'data' => [
                'key' => $key,
                'value' => $value,
            ],
            'message' => null,
            'success' => true,
        ]);
    }

    /**
     * 更新某个 setting
     * PUT /api/ecommerce/shop-settings/{key}
     *
     * 根据 key 做不同的 validation
     */
    public function update(Request $request, string $key)
    {
        if (! in_array($key, ['shop_contact_widget', 'homepage_products', 'shipping', 'footer'], true)) {
            return response()->json([
                'data' => null,
                'message' => 'Setting key not supported.',
                'success' => false,
            ], 404);
        }

        switch ($key) {
            case 'shop_contact_widget':
                $data = $this->validateShopContactWidget($request);
                break;

            case 'homepage_products':
                $data = $this->validateHomepageProducts($request);
                break;

            case 'shipping':
                $data = $this->validateShipping($request);
                break;

            case 'footer':
                $data = $this->validateFooter($request);
                break;

            default:
                throw ValidationException::withMessages([
                    'key' => ['Unsupported setting key.'],
                ]);
        }

        $setting = Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $data]
        );

        Cache::forget('public_homepage_v1');

        return response()->json([
            'data' => [
                'key' => $setting->key,
                'value' => $setting->value,
            ],
            'message' => 'Setting updated successfully.',
            'success' => true,
        ]);
    }

    protected function validateShopContactWidget(Request $request): array
    {
        $validated = $request->validate([
            'whatsapp.enabled' => ['required', 'boolean'],
            'whatsapp.phone' => ['nullable', 'string', 'max:50'],
            'whatsapp.default_message' => ['nullable', 'string', 'max:255'],
        ]);

        // 确保结构完整
        return [
            'whatsapp' => [
                'enabled' => (bool) data_get($validated, 'whatsapp.enabled', false),
                'phone' => data_get($validated, 'whatsapp.phone'),
                'default_message' => data_get($validated, 'whatsapp.default_message'),
            ],
        ];
    }

    protected function validateHomepageProducts(Request $request): array
    {
        $validated = $request->validate([
            'new_products_days' => ['required', 'integer', 'min:1', 'max:365'],
            'best_sellers_days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        return [
            'new_products_days' => (int) $validated['new_products_days'],
            'best_sellers_days' => (int) $validated['best_sellers_days'],
        ];
    }

    protected function validateShipping(Request $request): array
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'flat_fee' => ['required', 'numeric', 'min:0'],
            'currency' => ['required', 'string', 'max:10'],
            'label' => ['required', 'string', 'max:100'],
        ]);

        return [
            'enabled' => (bool) $validated['enabled'],
            'flat_fee' => (float) $validated['flat_fee'],
            'currency' => $validated['currency'],
            'label' => $validated['label'],
        ];
    }

    protected function validateFooter(Request $request): array
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'about_text' => ['nullable', 'string'],
            'contact.whatsapp' => ['nullable', 'string', 'max:50'],
            'contact.email' => ['nullable', 'email', 'max:255'],
            'contact.address' => ['nullable', 'string'],
            'social.instagram' => ['nullable', 'url'],
            'social.facebook' => ['nullable', 'url'],
            'social.tiktok' => ['nullable', 'url'],
            'links.shipping_policy' => ['nullable', 'string', 'max:255'],
            'links.return_refund' => ['nullable', 'string', 'max:255'],
            'links.privacy' => ['nullable', 'string', 'max:255'],
            'links.terms' => ['nullable', 'string', 'max:255'],
        ]);

        return [
            'enabled' => (bool) $validated['enabled'],
            'about_text' => $validated['about_text'] ?? null,
            'contact' => [
                'whatsapp' => data_get($validated, 'contact.whatsapp'),
                'email' => data_get($validated, 'contact.email'),
                'address' => data_get($validated, 'contact.address'),
            ],
            'social' => [
                'instagram' => data_get($validated, 'social.instagram'),
                'facebook' => data_get($validated, 'social.facebook'),
                'tiktok' => data_get($validated, 'social.tiktok'),
            ],
            'links' => [
                'shipping_policy' => data_get($validated, 'links.shipping_policy'),
                'return_refund' => data_get($validated, 'links.return_refund'),
                'privacy' => data_get($validated, 'links.privacy'),
                'terms' => data_get($validated, 'links.terms'),
            ],
        ];
    }

}
