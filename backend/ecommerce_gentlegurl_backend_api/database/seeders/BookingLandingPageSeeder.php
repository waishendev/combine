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
                        'label' => 'Premium Salon Booking',
                        'title' => 'Beauty appointments, made effortless.',
                        'subtitle' => 'Discover signature services, reserve your slot instantly, and arrive confident with our trusted professional team.',
                        'cta_label' => 'Book Appointment',
                        'cta_link' => '/booking',
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
                ],
                'is_active' => true,
            ]
        );
    }
}
