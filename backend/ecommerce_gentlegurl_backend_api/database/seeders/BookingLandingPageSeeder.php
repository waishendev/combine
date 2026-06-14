<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLandingPage;
use Illuminate\Database\Seeder;

class BookingLandingPageSeeder extends Seeder
{
    public function run(): void
    {
        BookingLandingPage::updateOrCreate(
            ['slug' => 'home'],
            [
            'sections' => [
                    'hero' => [
                        'is_active' => true,
                        'label' => 'Our Mission',
                        'title' => '',
                        'subtitle' => "We're here to rewrite the rules of nail art and craft designs that are **Weird, Creative, Unexpected and Unique**\nmobile\nWe're here to rewrite the rules of nail\n art and craft designs that are\n**Weird, Creative, Unexpected and Unique**",
                        'title_2' => '',
                        'subtitle_2' => '',
                        'cta_label' => 'Book Appointment',
                        'cta_link' => '/booking',
                        'decorations_enabled' => true,
                    ],
                    'gallery' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'GALLERY',
                            'title' => 'Click to view services and pricing',
                            'align' => 'center',
                        ],
                        'items' => [
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                        ],
                    ],
                    'service_menu' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'Service Menu',
                            'title' => 'Click to view services and pricing',
                            'align' => 'center',
                        ],
                        'items' => [
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                            ['src' => '/images/dummy.webp', 'caption' => 'DUMMY TEXT'],
                        ],
                    ],
                    'our_artists' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'Our Artists',
                            'title' => 'Meet our creative professionals',
                            'align' => 'center',
                        ],
                        'items' => [
                            ['src' => '/images/dummy.webp', 'caption' => 'Artist portrait', 'text' => 'Senior Stylist — 10 years experience', 'text_align' => 'center', 'link_url' => '/booking'],
                            ['src' => '/images/dummy.webp', 'caption' => 'Artist portrait', 'text' => 'Color Specialist — Balayage & highlights', 'text_align' => 'center', 'link_url' => ''],
                            ['src' => '/images/dummy.webp', 'caption' => 'Artist portrait', 'text' => 'Nail Artist — Gel and extensions', 'text_align' => 'center', 'link_url' => ''],
                            ['src' => '/images/dummy.webp', 'caption' => 'Artist portrait', 'text' => 'Makeup Artist — Bridal & events', 'text_align' => 'center', 'link_url' => ''],
                        ],
                    ],
                    'nail_academy' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'EXCELLENCE IN JAPANESE NAIL ART EDUCATION',
                            'title' => 'Nail Academy',
                            'align' => 'center',
                        ],
                        'target_label' => '面向对象',
                        'curriculum_label' => '教学核心',
                        'items' => [
                            [
                                'src' => '/images/dummy.webp',
                                'duration_badge' => '5 - 8 周',
                                'title' => '基础入门班 (Fundamental)',
                                'target_audience' => '零基础希望系统性入门美甲技艺的学员。',
                                'curriculum' => [
                                    '工具消毒与安全卫生流程',
                                    '自然甲修护与甲型打磨',
                                    '单色凝胶上色与基础彩绘',
                                    '沙龙接待流程与客户沟通',
                                ],
                                'details_link' => '/booking',
                                'details_label' => 'CLICK FOR MORE DETAILS →',
                                'text_align' => 'left',
                            ],
                            [
                                'src' => '/images/dummy.webp',
                                'duration_badge' => '10 - 14 周',
                                'title' => '全科创业班 (Professional)',
                                'target_audience' => '计划开店或独立接单的专业进阶学员。',
                                'curriculum' => [
                                    '高级延长与矫正技法',
                                    '日系晕染与立体饰品搭配',
                                    '门店运营、定价与物料管理',
                                    '作品集拍摄与社交媒体呈现',
                                ],
                                'details_link' => '/booking',
                                'details_label' => 'CLICK FOR MORE DETAILS →',
                                'text_align' => 'left',
                            ],
                            [
                                'src' => '/images/dummy.webp',
                                'duration_badge' => '7 天',
                                'title' => '美甲师矫正班 (Refinement)',
                                'target_audience' => '已有经验需纠正手势与提升精致度的美甲师。',
                                'curriculum' => [
                                    '常见手法误区一对一矫正',
                                    '极致单色与高光圈技法',
                                    '复杂款式拆解与提速训练',
                                    '客户满意度与复购策略',
                                ],
                                'details_link' => '',
                                'details_label' => 'CLICK FOR MORE DETAILS →',
                                'text_align' => 'left',
                            ],
                        ],
                    ],
                    'faqs' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'FAQ',
                            'title' => 'You might be wondering',
                            'align' => 'left',
                        ],
                        'items' => [
                            [
                                'question' => 'How long does a booking slot last?',
                                'answer' => 'DUMMY DATA: Each booking includes service time plus buffer time for setup and cleanup.',
                            ],
                            [
                                'question' => 'Can I reschedule my appointment?',
                                'answer' => 'DUMMY DATA: Yes, rescheduling is allowed subject to availability.',
                            ],
                            [
                                'question' => 'Do I need to pay a deposit?',
                                'answer' => "DUMMY DATA:\n• A small deposit may be required to confirm the booking.\n• Deposit is applied to the final total.",
                            ],
                            [
                                'question' => 'What should I prepare before arriving?',
                                'answer' => "DUMMY DATA:\n• Arrive 5 minutes early\n• Have your reference photos ready\n• Let us know allergies or sensitivities",
                            ],
                        ],
                    ],
                    'notes' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => 'Notes',
                            'title' => 'Policy & care',
                            'align' => 'left',
                        ],
                        'items' => [
                            'DUMMY DATA: Please arrive 5 minutes early to ensure your slot starts smoothly.',
                            'DUMMY DATA: Cancellations within 24 hours may forfeit the deposit.',
                            'DUMMY DATA: Late arrivals may reduce service time to avoid impacting the next booking.',
                            'DUMMY DATA: Follow recommended aftercare for best results.',
                        ],
                    ],
                    'visit_studio' => [
                        'is_active' => true,
                        'heading' => [
                            'label' => '',
                            'title' => 'Visit Our Studio',
                            'align' => 'left',
                        ],
                        'studio_name' => 'NAILSBYLITTLEBOO SALON',
                        'address' => "123 Example Street\nKuala Lumpur\nMalaysia",
                        'google_maps_url' => 'https://maps.google.com/',
                        'waze_url' => 'https://www.waze.com/',
                    'whatsapp_phone' => '60123456789',
                    'whatsapp_message' => 'Hi! I would like to get in touch about your salon services.',
                    'google_maps_label' => 'GOOGLE MAPS',
                        'waze_label' => 'OPEN WAZE',
                        'whatsapp_label' => 'MESSAGE US ON WHATSAPP',
                        'opening_hours_heading' => 'Opening Hours',
                        'opening_hours' => [
                            [
                                'day_range' => 'Monday — Friday',
                                'time_range' => '11:00 AM — 6:30 PM',
                            ],
                            [
                                'day_range' => 'Saturday — Sunday',
                                'time_range' => '9:00 AM — 4:30 PM',
                            ],
                        ],
                        'bottom_label' => "OPERATED BY DAUN SEGAR SDN BHD (1234567-A)\n© 2026 NAILSBYLITTLEBOO SALON",
                        'column_order' => 'contact_left',
                    ],
                ],
                'is_active' => true,
            ]
        );
    }
}
