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
            'shop_contact_widget' => SettingService::get('shop_contact_widget', [
                'whatsapp' => [
                    'enabled' => false,
                    'phone' => null,
                    'default_message' => null,
                ],
            ]),
            'homepage_products' => SettingService::get('homepage_products', [
                'new_products_days' => 30,
                'best_sellers_days' => 60,
            ]),
            'shipping' => SettingService::get('shipping', $this->defaultShippingSetting()),
            'footer' => SettingService::get('footer', $this->defaultFooterSetting()),
            'page_reviews' => SettingService::get('page_reviews', [
                'enabled' => true,
            ]),
            'product_reviews' => SettingService::get('product_reviews', [
                'enabled' => true,
                'review_window_days' => 30,
            ]),
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
        if (! in_array($key, ['shop_contact_widget', 'homepage_products', 'shipping', 'footer', 'page_reviews', 'product_reviews'], true)) {
            return response()->json([
                'data' => null,
                'message' => 'Setting key not supported.',
                'success' => false,
            ], 404);
        }

        $defaultValues = [
            'shop_contact_widget' => [
                'whatsapp' => [
                    'enabled' => false,
                    'phone' => null,
                    'default_message' => null,
                ],
            ],
            'homepage_products' => [
                'new_products_days' => 30,
                'best_sellers_days' => 60,
            ],
            'shipping' => $this->defaultShippingSetting(),
            'footer' => $this->defaultFooterSetting(),
            'page_reviews' => [
                'enabled' => true,
            ],
            'product_reviews' => [
                'enabled' => true,
                'review_window_days' => 30,
            ],
        ];

        $value = SettingService::get($key, $defaultValues[$key]);

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
        if (! in_array($key, ['shop_contact_widget', 'homepage_products', 'shipping', 'footer', 'page_reviews', 'product_reviews'], true)) {
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

            case 'page_reviews':
                $data = $this->validatePageReviews($request);
                break;

            case 'product_reviews':
                $data = $this->validateProductReviews($request);
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
            'currency' => ['required', 'string', 'max:10'],
            'label' => ['required', 'string', 'max:100'],
            'free_shipping.enabled' => ['nullable', 'boolean'],
            'free_shipping.min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'zones' => ['required', 'array'],
            'zones.MY_WEST.label' => ['required', 'string', 'max:100'],
            'zones.MY_WEST.countries' => ['required', 'array'],
            'zones.MY_WEST.countries.*' => ['string', 'max:10'],
            'zones.MY_WEST.states' => ['nullable', 'array'],
            'zones.MY_WEST.states.*' => ['string', 'max:100'],
            'zones.MY_WEST.fee' => ['required', 'numeric', 'min:0'],
            'zones.MY_EAST.label' => ['required', 'string', 'max:100'],
            'zones.MY_EAST.countries' => ['required', 'array'],
            'zones.MY_EAST.countries.*' => ['string', 'max:10'],
            'zones.MY_EAST.states' => ['nullable', 'array'],
            'zones.MY_EAST.states.*' => ['string', 'max:100'],
            'zones.MY_EAST.fee' => ['required', 'numeric', 'min:0'],
            'zones.SG.label' => ['required', 'string', 'max:100'],
            'zones.SG.countries' => ['required', 'array'],
            'zones.SG.countries.*' => ['string', 'max:10'],
            'zones.SG.states' => ['nullable', 'array'],
            'zones.SG.states.*' => ['string', 'max:100'],
            'zones.SG.fee' => ['required', 'numeric', 'min:0'],
            'fallback.mode' => ['required', 'in:block_checkout,use_default'],
            'fallback.default_fee' => ['required', 'numeric', 'min:0'],
        ]);

        return [
            'enabled' => (bool) $validated['enabled'],
            'currency' => $validated['currency'],
            'label' => $validated['label'],
            'free_shipping' => [
                'enabled' => (bool) data_get($validated, 'free_shipping.enabled', false),
                'min_order_amount' => (float) data_get($validated, 'free_shipping.min_order_amount', 0),
            ],
            'zones' => [
                'MY_WEST' => [
                    'label' => data_get($validated, 'zones.MY_WEST.label'),
                    'countries' => array_values((array) data_get($validated, 'zones.MY_WEST.countries', [])),
                    'states' => array_values((array) data_get($validated, 'zones.MY_WEST.states', [])),
                    'fee' => (float) data_get($validated, 'zones.MY_WEST.fee', 0),
                ],
                'MY_EAST' => [
                    'label' => data_get($validated, 'zones.MY_EAST.label'),
                    'countries' => array_values((array) data_get($validated, 'zones.MY_EAST.countries', [])),
                    'states' => array_values((array) data_get($validated, 'zones.MY_EAST.states', [])),
                    'fee' => (float) data_get($validated, 'zones.MY_EAST.fee', 0),
                ],
                'SG' => [
                    'label' => data_get($validated, 'zones.SG.label'),
                    'countries' => array_values((array) data_get($validated, 'zones.SG.countries', [])),
                    'states' => array_values((array) data_get($validated, 'zones.SG.states', [])),
                    'fee' => (float) data_get($validated, 'zones.SG.fee', 0),
                ],
            ],
            'fallback' => [
                'mode' => data_get($validated, 'fallback.mode'),
                'default_fee' => (float) data_get($validated, 'fallback.default_fee', 0),
            ],
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

    protected function validatePageReviews(Request $request): array
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        return [
            'enabled' => (bool) $validated['enabled'],
        ];
    }

    protected function validateProductReviews(Request $request): array
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'review_window_days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        return [
            'enabled' => (bool) $validated['enabled'],
            'review_window_days' => (int) $validated['review_window_days'],
        ];
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
                'instagram' => null,
                'facebook' => null,
                'tiktok' => null,
            ],
            'links' => [
                'shipping_policy' => '/shipping-policy',
                'return_refund' => '/return-refund',
                'privacy' => '/privacy-policy',
                'terms' => '/terms',
            ],
        ];
    }

    protected function defaultShippingSetting(): array
    {
        return [
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
        ];
    }
}
