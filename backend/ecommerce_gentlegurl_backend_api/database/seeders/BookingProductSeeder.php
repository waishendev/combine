<?php

namespace Database\Seeders;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingProductCategory;
use App\Models\Booking\BookingProductQuestion;
use Illuminate\Database\Seeder;

class BookingProductSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Treatment', 'sort_order' => 1, 'is_active' => true],
            ['name' => 'Scalp Care', 'sort_order' => 2, 'is_active' => true],
            ['name' => 'Wash', 'sort_order' => 3, 'is_active' => true],
            ['name' => 'Styling', 'sort_order' => 4, 'is_active' => true],
            ['name' => 'Color Products', 'sort_order' => 5, 'is_active' => true],
            ['name' => 'Retail Take-home', 'sort_order' => 6, 'is_active' => true],
        ];

        $categoryMap = [];
        foreach ($categories as $cat) {
            $row = BookingProductCategory::query()->updateOrCreate(['name' => $cat['name']], $cat);
            $categoryMap[$cat['name']] = (int) $row->id;
        }

        $rows = [
            // --- Range main products (POS / settlement range testing) ---
            [
                'name' => 'Custom Color Mix',
                'cn_name' => '定制染发调配',
                'price_mode' => 'range',
                'price_range_min' => 45.00,
                'price_range_max' => 95.00,
                'description' => 'Main salon-mixed color product; final price depends on length and formula.',
                'categories' => ['Color Products'],
                'questions' => [
                    [
                        'title' => 'Color mix options',
                        'cn_title' => '染发调配选项',
                        'description' => 'Select one mix tier.',
                        'cn_description' => '请选择一种调配等级。',
                        'question_type' => 'single_choice',
                        'sort_order' => 1,
                        'is_required' => true,
                        'is_active' => true,
                        'options' => [
                            ['label' => 'Root touch-up only', 'cn_label' => '仅补发根', 'extra_price' => 0, 'sort_order' => 1, 'is_active' => true],
                            ['label' => 'Full head standard', 'cn_label' => '全头标准', 'extra_price' => 25, 'sort_order' => 2, 'is_active' => true],
                            ['label' => 'Full head premium bleach', 'cn_label' => '全头高级漂染', 'extra_price' => 50, 'sort_order' => 3, 'is_active' => true],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Keratin Booster Kit',
                'cn_name' => '角蛋白加强套组',
                'price_mode' => 'range',
                'price_range_min' => 80.00,
                'price_range_max' => 160.00,
                'description' => 'Main keratin booster kit sized by hair length.',
                'categories' => ['Treatment', 'Retail Take-home'],
                'questions' => [],
            ],
            [
                'name' => 'Take-home Repair Set',
                'cn_name' => '居家修护套组',
                'price_mode' => 'range',
                'price_range_min' => 120.00,
                'price_range_max' => 220.00,
                'description' => 'Main retail repair set (shampoo + mask + serum).',
                'categories' => ['Retail Take-home', 'Treatment'],
                'questions' => [
                    [
                        'title' => 'Set size',
                        'cn_title' => '套组容量',
                        'description' => 'Choose retail set size.',
                        'cn_description' => '请选择套组容量。',
                        'question_type' => 'single_choice',
                        'sort_order' => 1,
                        'is_required' => true,
                        'is_active' => true,
                        'options' => [
                            ['label' => 'Travel size', 'cn_label' => '旅行装', 'extra_price' => 0, 'sort_order' => 1, 'is_active' => true],
                            ['label' => 'Standard size', 'cn_label' => '标准装', 'extra_price' => 50, 'sort_order' => 2, 'is_active' => true],
                            ['label' => 'Salon size', 'cn_label' => '沙龙大装', 'extra_price' => 100, 'sort_order' => 3, 'is_active' => true],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Premium Styling Kit',
                'cn_name' => '高级造型套组',
                'price_mode' => 'range',
                'price_range_min' => 35.00,
                'price_range_max' => 75.00,
                'description' => 'Main styling kit for event or photo-ready finish.',
                'categories' => ['Styling', 'Retail Take-home'],
                'questions' => [],
            ],

            // --- Range add-on products (linked-style extras for range testing) ---
            [
                'name' => 'Hair Treatment Add-on',
                'cn_name' => '护发附加',
                'price_mode' => 'range',
                'price_range_min' => 35.00,
                'price_range_max' => 75.00,
                'description' => 'Range-priced treatment booster during appointment.',
                'categories' => ['Treatment', 'Styling'],
                'questions' => [
                    [
                        'title' => 'Choose treatment intensity',
                        'cn_title' => '选择护理强度',
                        'description' => 'Pick one treatment intensity.',
                        'cn_description' => '请选择一种护理强度。',
                        'question_type' => 'single_choice',
                        'sort_order' => 1,
                        'is_required' => true,
                        'is_active' => true,
                        'options' => [
                            ['label' => 'Normal Repair', 'cn_label' => '基础修护', 'extra_price' => 0, 'sort_order' => 1, 'is_active' => true],
                            ['label' => 'Deep Repair', 'cn_label' => '深层修护', 'extra_price' => 15, 'sort_order' => 2, 'is_active' => true],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Scalp Ampoule Add-on',
                'cn_name' => '头皮安瓶附加',
                'price_mode' => 'range',
                'price_range_min' => 25.00,
                'price_range_max' => 55.00,
                'description' => 'Range-priced scalp ampoule add-on.',
                'categories' => ['Scalp Care', 'Treatment'],
                'questions' => [
                    [
                        'title' => 'Optional scalp boosters',
                        'cn_title' => '头皮加强护理（可选）',
                        'description' => 'You may pick multiple boosters.',
                        'cn_description' => '可选择多个加强护理。',
                        'question_type' => 'multi_choice',
                        'sort_order' => 1,
                        'is_required' => false,
                        'is_active' => true,
                        'options' => [
                            ['label' => 'Cooling Mint', 'cn_label' => '薄荷清凉', 'extra_price' => 5, 'sort_order' => 1, 'is_active' => true],
                            ['label' => 'Anti Dandruff', 'cn_label' => '去屑护理', 'extra_price' => 8, 'sort_order' => 2, 'is_active' => true],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Premium Wash Add-on',
                'cn_name' => '高级洗护附加',
                'price_mode' => 'range',
                'price_range_min' => 18.00,
                'price_range_max' => 38.00,
                'description' => 'Range-priced wash and rinse upgrade.',
                'categories' => ['Wash'],
                'questions' => [],
            ],
            [
                'name' => 'Styling Add-on',
                'cn_name' => '造型附加',
                'price_mode' => 'range',
                'price_range_min' => 22.00,
                'price_range_max' => 48.00,
                'description' => 'Range-priced quick styling finish add-on.',
                'categories' => ['Styling'],
                'questions' => [],
            ],
            [
                'name' => 'Scalp Detox Pack Add-on',
                'cn_name' => '头皮深层清洁附加',
                'price_mode' => 'range',
                'price_range_min' => 55.00,
                'price_range_max' => 110.00,
                'description' => 'Range-priced scalp detox add-on pack.',
                'categories' => ['Scalp Care', 'Treatment'],
                'questions' => [
                    [
                        'title' => 'Detox intensity',
                        'cn_title' => '清洁强度',
                        'description' => 'Pick detox level.',
                        'cn_description' => '请选择清洁强度。',
                        'question_type' => 'single_choice',
                        'sort_order' => 1,
                        'is_required' => false,
                        'is_active' => true,
                        'options' => [
                            ['label' => 'Maintenance', 'cn_label' => '日常维护', 'extra_price' => 0, 'sort_order' => 1, 'is_active' => true],
                            ['label' => 'Intensive', 'cn_label' => '深层加强', 'extra_price' => 20, 'sort_order' => 2, 'is_active' => true],
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Bond Builder Add-on',
                'cn_name' => '结构修护附加',
                'price_mode' => 'range',
                'price_range_min' => 30.00,
                'price_range_max' => 65.00,
                'description' => 'Range-priced bond builder mixed in-service.',
                'categories' => ['Color Products', 'Treatment'],
                'questions' => [],
            ],
            [
                'name' => 'Gloss Toner Add-on',
                'cn_name' => '光泽调色附加',
                'price_mode' => 'range',
                'price_range_min' => 40.00,
                'price_range_max' => 78.00,
                'description' => 'Range-priced gloss toner add-on.',
                'categories' => ['Color Products', 'Treatment'],
                'questions' => [],
            ],
            [
                'name' => 'Deep Mask Add-on',
                'cn_name' => '深层发膜附加',
                'price_mode' => 'range',
                'price_range_min' => 50.00,
                'price_range_max' => 95.00,
                'description' => 'Range-priced deep mask add-on.',
                'categories' => ['Treatment'],
                'questions' => [],
            ],

            // --- Fixed products (contrast / simple checkout paths) ---
            ['name' => 'Dry Shampoo', 'cn_name' => '干洗发', 'price' => 15.00, 'description' => 'Quick refresh between washes.', 'categories' => ['Wash', 'Styling'], 'questions' => []],
            ['name' => 'Hair Mask Sachet', 'cn_name' => '发膜单包', 'price' => 12.00, 'description' => 'Single-use intensive mask sachet.', 'categories' => ['Treatment'], 'questions' => []],
        ];

        foreach ($rows as $row) {
            $pricing = $this->normalizeProductPricing($row);

            $product = BookingProduct::query()->updateOrCreate(['name' => $row['name']], [
                'cn_name' => $row['cn_name'] ?? null,
                'price' => $pricing['price'],
                'price_mode' => $pricing['price_mode'],
                'price_range_min' => $pricing['price_range_min'],
                'price_range_max' => $pricing['price_range_max'],
                'barcode' => $row['barcode'] ?? null,
                'description' => $row['description'],
                'image_path' => null,
                'is_active' => true,
            ]);

            $product->categories()->sync(
                collect($row['categories'])
                    ->map(fn ($name) => $categoryMap[$name] ?? null)
                    ->filter()
                    ->values()
                    ->all()
            );

            $existingQuestionIds = $product->questions()->pluck('id')->all();
            $keepQuestionIds = [];

            foreach (($row['questions'] ?? []) as $question) {
                $questionModel = BookingProductQuestion::query()->updateOrCreate(
                    [
                        'booking_product_id' => $product->id,
                        'title' => $question['title'],
                    ],
                    [
                        'cn_title' => $question['cn_title'] ?? null,
                        'description' => $question['description'] ?? null,
                        'cn_description' => $question['cn_description'] ?? null,
                        'question_type' => $question['question_type'] ?? 'single_choice',
                        'sort_order' => (int) ($question['sort_order'] ?? 0),
                        'is_required' => (bool) ($question['is_required'] ?? false),
                        'is_active' => (bool) ($question['is_active'] ?? true),
                    ]
                );

                $keepQuestionIds[] = (int) $questionModel->id;
                $existingOptionIds = $questionModel->options()->pluck('id')->all();
                $keepOptionIds = [];

                foreach (($question['options'] ?? []) as $option) {
                    $optionModel = $questionModel->options()->updateOrCreate(
                        ['label' => $option['label']],
                        [
                            'cn_label' => $option['cn_label'] ?? null,
                            'extra_price' => (float) ($option['extra_price'] ?? 0),
                            'sort_order' => (int) ($option['sort_order'] ?? 0),
                            'is_active' => (bool) ($option['is_active'] ?? true),
                        ]
                    );
                    $keepOptionIds[] = (int) $optionModel->id;
                }

                $toDeleteOptionIds = array_diff($existingOptionIds, $keepOptionIds);
                if (! empty($toDeleteOptionIds)) {
                    $questionModel->options()->whereIn('id', $toDeleteOptionIds)->delete();
                }
            }

            $toDeleteQuestionIds = array_diff($existingQuestionIds, $keepQuestionIds);
            if (! empty($toDeleteQuestionIds)) {
                $product->questions()->whereIn('id', $toDeleteQuestionIds)->delete();
            }
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{price: float, price_mode: string, price_range_min: ?float, price_range_max: ?float}
     */
    private function normalizeProductPricing(array $row): array
    {
        $mode = ($row['price_mode'] ?? 'fixed') === 'range' ? 'range' : 'fixed';

        if ($mode === 'range') {
            $min = round((float) ($row['price_range_min'] ?? $row['price'] ?? 0), 2);
            $max = round((float) ($row['price_range_max'] ?? $min), 2);

            return [
                'price' => $min,
                'price_mode' => 'range',
                'price_range_min' => $min,
                'price_range_max' => max($min, $max),
            ];
        }

        return [
            'price' => round((float) ($row['price'] ?? 0), 2),
            'price_mode' => 'fixed',
            'price_range_min' => null,
            'price_range_max' => null,
        ];
    }
}
