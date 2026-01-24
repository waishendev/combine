<?php

namespace Database\Seeders;

use App\Models\Ecommerce\ServicesMenuItem;
use App\Models\Ecommerce\ServicesPage;
use Illuminate\Database\Seeder;

class ServicesMenuAndPagesSeeder extends Seeder
{
    public function run(): void
    {
        $pages = [
            [
                'name' => 'Nail Services',
                'slug' => 'nail-services',
                'sort_order' => 1,
                'subtitle' => "Hi dear🥰 Here's our price list📋 Please let us know in advance so we can reserve sufficient time for your appointment.",
                'hero_slides' => [
                    [
                        'src' => '/images/CUSTOMERGIVE/Manicure.jpeg',
                        'alt' => 'Classic manicure service',
                        'title' => 'Manicure & Gel Manicure',
                        'description' => 'Cuticle care, shaping, and polish options from classic shades to art design and mystery boxes.',
                        'buttonLabel' => 'Book Manicure',
                    ],
                    [
                        'src' => '/images/CUSTOMERGIVE/Gel Manicure.jpeg',
                        'alt' => 'Gel manicure finish',
                        'title' => 'Long-lasting gel color',
                        'description' => 'Choose plain, glitter, cat eye, chrome, or custom finishing for a durable gel manicure.',
                        'buttonLabel' => 'See Gel Options',
                    ],
                    [
                        'src' => '/images/CUSTOMERGIVE/Gel Manicure with Design.jpeg',
                        'alt' => 'Gel manicure with nail art',
                        'title' => 'Custom creative nail art',
                        'description' => 'Share your reference photos early so we can reserve enough time for detailed art sessions.',
                        'buttonLabel' => 'Plan Nail Art',
                    ],
                    [
                        'src' => '/images/CUSTOMERGIVE/Gel Pedicure.jpeg',
                        'alt' => 'Gel pedicure service',
                        'title' => 'Pedicure & gel pedicure',
                        'description' => 'Relaxing foot care paired with gel finishes that stay glossy and chip-resistant for weeks.',
                        'buttonLabel' => 'Book Pedicure',
                    ],
                    [
                        'src' => '/images/CUSTOMERGIVE/Gel Pedicure with Design.jpeg',
                        'alt' => 'Gel pedicure with design',
                        'title' => 'Spa upgrades & enhancements',
                        'description' => 'Add masks, scrubs, massage, and collagen therapy to turn your appointment into a full spa experience.',
                        'buttonLabel' => 'Add Spa Upgrade',
                    ],
                ],
                'sections' => [
                    'services' => [
                        'is_active' => true,
                        'items' => [
                            [
                                'title' => 'Manicure & Gel Manicure',
                                'description' => 'Cuticle care, shaping, and polish options from classic color to art design and mystery boxes.',
                            ],
                            [
                                'title' => 'Pedicure & Gel Pedicure',
                                'description' => 'Foot care with plain, glitter, cat eye, chrome, or art design finishes.',
                            ],
                            [
                                'title' => 'Spa Enhancements',
                                'description' => 'Standard or deluxe spa upgrades with masks, scrubs, massage, and collagen therapy options.',
                            ],
                            [
                                'title' => 'Nail Extension',
                                'description' => 'Full set or partial extensions, plus structure rebalancing for long natural nails.',
                            ],
                            [
                                'title' => 'Nail Art',
                                'description' => 'Custom creative nail art sessions with advance booking required.',
                            ],
                            [
                                'title' => 'Removal & Repair',
                                'description' => 'Gentle removal for gel or extensions, with options to continue or not continue service.',
                            ],
                        ],
                    ],
                    'pricing' => [
                        'is_active' => true,
                        'items' => [
                            ['label' => 'Manicure (no color)', 'price' => 'RM 45'],
                            ['label' => 'Gel Manicure (plain / glitter)', 'price' => 'RM 98'],
                            ['label' => 'Gel Pedicure (plain / glitter)', 'price' => 'RM 78'],
                            ['label' => 'Custom Creative Nail Art', 'price' => 'From RM 288'],
                            ['label' => 'Standard Spa Add-on', 'price' => 'RM 48'],
                            ['label' => 'Deluxe Spa Add-on', 'price' => 'RM 68'],
                        ],
                    ],
                    'faqs' => [
                        'is_active' => true,
                        'items' => [
                            [
                                'question' => 'How do I book?',
                                'answer' => 'Let us know your service preferences and we will confirm the appointment once time is reserved.',
                            ],
                            [
                                'question' => 'What should I include in my request?',
                                'answer' => 'Please share nail extension (full set / partial) and removal preference (natural / extensions / none) in advance.',
                            ],
                            [
                                'question' => 'Do you offer waxing or laser services?',
                                'answer' => 'Yes, waxing and 810 laser services are available. Ask us for details when booking.',
                            ],
                            [
                                'question' => 'What else is in-store?',
                                'answer' => 'We carry Korean & Chinese beauty products and POP MART blind boxes for you to browse.',
                            ],
                            [
                                'question' => 'Is the appointment confirmed immediately?',
                                'answer' => 'An appointment is confirmed only after receiving a confirmation message. If not received, please remind us.',
                            ],
                        ],
                    ],
                    'notes' => [
                        'is_active' => true,
                        'items' => [
                            'Hi dear🥰 Here’s our price list📋 Please let us know in advance so we can reserve sufficient time for your appointment.',
                            'Service: Nail extension (full set / partial) and removal option (remove natural nails / remove extensions / none).',
                            '⚠️ An appointment is confirmed only after receiving a confirmation message. If not received, please remind us. Thank you!',
                            '💖 Waxing / 810 laser services are also available.',
                            'We also carry Korean & Chinese beauty products and POP MART blind boxes — feel free to have a look during your visit 🛒',
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Waxing & Hair Removal',
                'slug' => 'waxing-hair-removal',
                'sort_order' => 2,
                'subtitle' => 'Gentle, clean hair removal with smooth results — comfort-first, always.',
                'hero_slides' => [
                    [
                        'src' => '/images/CUSTOMERGIVE/Waxing.jpeg',
                        'alt' => 'Waxing service highlight',
                    ],
                    [
                        'src' => '/images/CUSTOMERGIVE/810 Laser Ice Hair Removal.jpeg',
                        'alt' => 'Laser hair removal highlight',
                    ],
                ],
                'sections' => [
                    'services' => [
                        'is_active' => true,
                        'items' => [
                            ['title' => 'Waxing (Upper Body)', 'description' => 'Arms, underarm, back, chest, and stomach options with smooth results.'],
                            ['title' => 'Waxing (Lower Body)', 'description' => 'Lower leg to full leg services for a polished, even finish.'],
                            ['title' => 'Waxing (Bikini)', 'description' => 'Bikini line, clipping, and Brazilian options available.'],
                            ['title' => 'Waxing (Face)', 'description' => 'Eyebrow, lip, chin, jawline, and full-face services.'],
                            ['title' => '810 Laser Ice Hair Removal', 'description' => 'Armpit, full arm, and full leg packages with session options.'],
                            ['title' => 'Keratin Lash Lift', 'description' => 'Lifted, curled lashes with a clean, natural finish.'],
                        ],
                    ],
                    'pricing' => [
                        'is_active' => true,
                        'items' => [
                            ['label' => 'Waxing - Upper Body: Under Arm (Armpit)', 'price' => 'RM 48'],
                            ['label' => 'Waxing - Upper Body: Lower Arm', 'price' => 'RM 68'],
                            ['label' => 'Waxing - Upper Body: Upper Arm or 3/4 Arm', 'price' => 'RM 88'],
                            ['label' => 'Waxing - Upper Body: Full Arm', 'price' => 'RM 108'],
                            ['label' => 'Waxing - Upper Body: Under Arm (Armpit) + Full Arm', 'price' => 'RM 168'],
                            ['label' => 'Waxing - Upper Body: Full Back and Shoulder', 'price' => 'RM 78'],
                            ['label' => 'Waxing - Upper Body: Chest and Stomach', 'price' => 'RM 78'],
                            ['label' => 'Waxing - Upper Body: Stomach', 'price' => 'RM 48'],
                            ['label' => 'Waxing - Lower Body: Lower Leg', 'price' => 'RM 68'],
                            ['label' => 'Waxing - Lower Body: Upper Leg or 3/4 Leg', 'price' => 'RM 118'],
                            ['label' => 'Waxing - Lower Body: Full Leg', 'price' => 'RM 148'],
                            ['label' => 'Waxing - Bikini: Bikini Line', 'price' => 'RM 78'],
                            ['label' => 'Waxing - Bikini: Bikini Line and Clipping', 'price' => 'RM 88'],
                            ['label' => 'Waxing - Bikini: Brazilian XXX (All Off)', 'price' => 'RM 198'],
                            ['label' => 'Waxing - Bikini: Brazilian Triangle or Line', 'price' => 'RM 178'],
                            ['label' => 'Waxing - Face: Eyebrow', 'price' => 'RM 38'],
                            ['label' => 'Waxing - Face: Forehead', 'price' => 'RM 38'],
                            ['label' => 'Waxing - Face: Cheeks', 'price' => 'RM 48'],
                            ['label' => 'Waxing - Face: Sideburn', 'price' => 'RM 38'],
                            ['label' => 'Waxing - Face: Lip', 'price' => 'RM 38'],
                            ['label' => 'Waxing - Face: Chin', 'price' => 'RM 48'],
                            ['label' => 'Waxing - Face: Lip and Chin', 'price' => 'RM 78'],
                            ['label' => 'Waxing - Face: Jaw Lines', 'price' => 'RM 38'],
                            ['label' => 'Waxing - Face: Neck', 'price' => 'RM 48'],
                            ['label' => 'Waxing - Face: Full Face', 'price' => 'RM 198'],
                            ['label' => '810 Laser Ice Hair Removal (Armpit) - Single Session', 'price' => 'RM 68'],
                            ['label' => '810 Laser Ice Hair Removal (Armpit) - Monthly Package', 'price' => 'RM 138'],
                            ['label' => '810 Laser Ice Hair Removal (Armpit) - Yearly Package', 'price' => 'RM 488'],
                            ['label' => '810 Laser Ice Hair Removal (Full Arm) - Single Session', 'price' => 'RM 88'],
                            ['label' => '810 Laser Ice Hair Removal (Full Arm) - Monthly Package', 'price' => 'RM 168'],
                            ['label' => '810 Laser Ice Hair Removal (Full Arm) - Yearly Package', 'price' => 'RM 888'],
                            ['label' => '810 Laser Ice Hair Removal (Full Leg) - Single Session', 'price' => 'RM 118'],
                            ['label' => '810 Laser Ice Hair Removal (Full Leg) - Monthly Package', 'price' => 'RM 248'],
                            ['label' => '810 Laser Ice Hair Removal (Full Leg) - Yearly Package', 'price' => 'RM 1188'],
                            ['label' => 'Keratin Lash Lift', 'price' => 'RM 108'],
                        ],
                    ],
                    'faqs' => [
                        'is_active' => true,
                        'items' => [
                            ['question' => 'Does waxing hurt?', 'answer' => 'You may feel a quick sting, but we use gentle wax and calming care to keep you comfortable.'],
                            ['question' => 'How long will results last?', 'answer' => 'Results typically last 2–4 weeks depending on your growth cycle and aftercare.'],
                            ['question' => 'What hair length is best?', 'answer' => 'Around a grain-of-rice length (about 0.5cm) helps wax grip well without tugging.'],
                            ['question' => 'Can I wax during sensitive skin days?', 'answer' => 'If your skin is irritated or you are on sensitive days, let us know—we can reschedule or proceed gently.'],
                            ['question' => 'What aftercare should I follow?', 'answer' => 'Avoid heat, sauna, swimming, or tight clothing for 24 hours and moisturize with gentle products.'],
                        ],
                    ],
                    'notes' => [
                        'is_active' => true,
                        'items' => [
                            'Avoid exfoliating 24 hours before.',
                            'Avoid sauna/sun exposure 24 hours after.',
                            'We use hygiene-first single-use practices where applicable.',
                            'If you’re using retinoids, please inform us before booking.',
                            'Subject to technician availability.',
                        ],
                    ],
                ],
            ],
            [
                'name' => '美甲全科班',
                'slug' => 'nail-courses',
                'sort_order' => 3,
                'subtitle' => '线上/线下｜只适合刚入行新手小白或爱好者',
                'hero_slides' => [
                    ['src' => '/images/CUSTOMERGIVE/Manicure.jpeg', 'alt' => 'Gel manicure with design'],
                    ['src' => '/images/CUSTOMERGIVE/Gel Manicure.jpeg', 'alt' => 'Gel manicure with design'],
                    ['src' => '/images/CUSTOMERGIVE/Gel Manicure with Design.jpeg', 'alt' => 'Gel manicure with design'],
                    ['src' => '/images/CUSTOMERGIVE/Gel Pedicure.jpeg', 'alt' => 'Gel manicure with design'],
                    ['src' => '/images/CUSTOMERGIVE/Gel Pedicure with Design.jpeg', 'alt' => 'Gel pedicure with design'],
                ],
                'sections' => [
                    'services' => [
                        'is_active' => true,
                        'items' => [
                            ['title' => '适合对象', 'description' => '只适合刚入行新手小白或爱好者。'],
                            ['title' => '课程模式', 'description' => '线上/线下授课，提供免费线上询问一年。'],
                            ['title' => '课程天数', 'description' => '3天精华满满浓缩版课程。'],
                            ['title' => '上课时间', 'description' => '10am-4pm（包含一小时午餐休息）。'],
                            ['title' => '地点', 'description' => 'Gentlegurls, 14 Lebuh Cintra, Penang。'],
                            ['title' => '毕业文凭', 'description' => '课后提供工作室毕业文凭。'],
                        ],
                    ],
                    'pricing' => [
                        'is_active' => true,
                        'items' => [
                            ['label' => '学费（优惠价）', 'price' => 'RM3888'],
                            ['label' => '定金', 'price' => 'RM888'],
                            ['label' => '包工具 / 机器 / 材料', 'price' => '已包含'],
                            ['label' => '课程天数', 'price' => '3天'],
                            ['label' => '上课时间', 'price' => '10am-4pm'],
                        ],
                    ],
                    'faqs' => [
                        'is_active' => true,
                        'items' => [
                            [
                                'question' => '课程 Day 1',
                                'answer' => '• 认识美甲工具和笔刷 • 认识指甲结构 • 了解甲型与手型搭配 • 学习修不同甲型 • 修剪死皮方式 • 前置处理日式+俄式 • 搓条使用方式 • 建构教程 • 涂单色技巧 • 功能胶用法和讲解',
                            ],
                            [
                                'question' => '课程 Day 2',
                                'answer' => '• 甲片延长半贴操作 • 顺序消毒方式 • 堆钻法 • 贴饰品教程 • 真人实操练习延长 • 卸甲教程',
                            ],
                            [
                                'question' => '课程 Day 3',
                                'answer' => '• 腮红美甲教程 • 多种猫眼技巧 • 渐变操作方式 • 魔镜粉教程 • 格纹教程 • 经典法式 • 玻璃纸/亮片 • 基础晕染 • 花瓣彩绘胶用法 • 简单绘画 • 豹纹 • 斑马纹 • 小香风 • 基础线条笔控 • 真人实操练习设计款 • 学习拆解美甲设计款 • 了解如何回答客人常问的问题',
                            ],
                            [
                                'question' => '学费包含材料',
                                'answer' => '• 课程课本 • 建构胶 • 光疗灯 • 打磨机与基本打磨头 • 死皮剪 • 指甲剪 • 搓条 • 营养油 • 色胶（透色x1、实色x1、封层x1） • 点珠笔/建构笔/彩绘笔 • 酒精 • 棉片盒 • 粉尘刷 • 工具箱',
                            ],
                            [
                                'question' => '学员自备',
                                'answer' => '• 小食（以防上课加时） • 干净的空手指（有美甲请先卸除）',
                            ],
                        ],
                    ],
                    'notes' => [
                        'is_active' => true,
                        'items' => [
                            '上课前一个星期需付清全款。',
                            '学费已包含工具、机器与材料。',
                            '提供免费线上询问一年。',
                            '课程结束可获得工作室毕业文凭。',
                        ],
                    ],
                ],
            ],
        ];

        foreach ($pages as $pageData) {
            $menuItem = ServicesMenuItem::updateOrCreate(
                ['slug' => $pageData['slug']],
                [
                    'name' => $pageData['name'],
                    'sort_order' => $pageData['sort_order'],
                    'is_active' => true,
                ]
            );

            $slides = $this->normalizeSlides($pageData['hero_slides']);

            $page = ServicesPage::updateOrCreate(
                ['services_menu_item_id' => $menuItem->id],
                [
                    'title' => $pageData['name'],
                    'slug' => $pageData['slug'],
                    'subtitle' => $pageData['subtitle'],
                    'hero_slides' => $slides,
                    'sections' => $pageData['sections'],
                    'is_active' => true,
                ]
            );

            $page->slides()->delete();
            if (! empty($slides)) {
                $page->slides()->createMany(array_map(function (array $slide) {
                    return [
                        'sort_order' => $slide['sort_order'],
                        'desktop_src' => $slide['src'],
                        'mobile_src' => $slide['mobileSrc'] ?: null,
                        'alt' => $slide['alt'],
                        'title' => $slide['title'] ?: null,
                        'description' => $slide['description'] ?: null,
                        'button_label' => $slide['buttonLabel'] ?: null,
                        'button_href' => $slide['buttonHref'] ?: null,
                    ];
                }, $slides));
            }
        }
    }

    private function normalizeSlides(array $slides): array
    {
        $normalized = [];

        foreach (array_values($slides) as $index => $slide) {
            if (! is_array($slide)) {
                continue;
            }

            $normalized[] = [
                'sort_order' => (int) ($slide['sort_order'] ?? $index + 1),
                'src' => (string) ($slide['src'] ?? ''),
                'mobileSrc' => (string) ($slide['mobileSrc'] ?? ''),
                'alt' => (string) ($slide['alt'] ?? ''),
                'title' => (string) ($slide['title'] ?? ''),
                'description' => (string) ($slide['description'] ?? ($slide['subtitle'] ?? '')),
                'buttonLabel' => (string) ($slide['buttonLabel'] ?? ''),
                'buttonHref' => (string) ($slide['buttonHref'] ?? ''),
            ];
        }

        usort($normalized, fn (array $a, array $b) => $a['sort_order'] <=> $b['sort_order']);
        foreach ($normalized as $index => $slide) {
            $normalized[$index]['sort_order'] = $index + 1;
        }

        return $normalized;
    }
}
