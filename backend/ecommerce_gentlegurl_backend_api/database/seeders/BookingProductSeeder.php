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
        ];

        $categoryMap = [];
        foreach ($categories as $cat) {
            $row = BookingProductCategory::query()->updateOrCreate(['name' => $cat['name']], $cat);
            $categoryMap[$cat['name']] = (int) $row->id;
        }

        $rows = [
            [
                'name' => 'Hair Treatment Add-on',
                'cn_name' => '护发附加',
                'price' => 39.00,
                'description' => 'Express treatment booster during appointment.',
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
                'name' => 'Scalp Ampoule',
                'cn_name' => '头皮安瓶',
                'price' => 25.00,
                'description' => 'Scalp nourishing ampoule add-on.',
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
            ['name' => 'Premium Wash Add-on', 'cn_name' => '高级洗护附加', 'price' => 18.00, 'description' => 'Premium wash and rinse upgrade.', 'categories' => ['Wash'], 'questions' => []],
            ['name' => 'Styling Add-on', 'cn_name' => '造型附加', 'price' => 22.00, 'description' => 'Quick styling finish add-on.', 'categories' => ['Styling'], 'questions' => []],
        ];

        foreach ($rows as $row) {
            $product = BookingProduct::query()->updateOrCreate(['name' => $row['name']], [
                'cn_name' => $row['cn_name'] ?? null,
                'price' => $row['price'],
                'barcode' => null,
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
}
