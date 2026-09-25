<?php

namespace Tests\Feature;

use App\Models\Booking\BookingQuestionPreset;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Booking\BookingQuestionPresetSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingQuestionPresetTest extends TestCase
{
    use RefreshDatabase;

    public function test_multi_attach_preset_edit_propagates_and_customs_survive(): void
    {
        $user = $this->actor();
        $addon = $this->service('Addon Wax');
        $serviceA = $this->service('Service A');
        $serviceB = $this->service('Service B');

        $create = $this->actingAs($user)->postJson('/api/admin/booking/question-presets', [
            'name' => 'Nail add-ons',
            'is_active' => true,
            'questions' => [
                [
                    'title' => 'Shape?',
                    'question_type' => 'single_choice',
                    'is_required' => true,
                    'is_active' => true,
                    'options' => [
                        [
                            'label' => 'Almond',
                            'linked_booking_service_id' => $addon->id,
                            'is_active' => true,
                            'allow_quantity' => true,
                        ],
                    ],
                ],
            ],
        ])->assertCreated();

        $presetId = (int) $create->json('data.id');
        $this->assertGreaterThan(0, $presetId);

        $second = $this->actingAs($user)->postJson('/api/admin/booking/question-presets', [
            'name' => 'Extra polish',
            'is_active' => true,
            'questions' => [
                [
                    'title' => 'Polish?',
                    'question_type' => 'single_choice',
                    'is_required' => false,
                    'is_active' => true,
                    'options' => [
                        [
                            'label' => 'Gloss',
                            'linked_booking_service_id' => $addon->id,
                            'is_active' => true,
                        ],
                    ],
                ],
            ],
        ])->assertCreated();
        $presetBId = (int) $second->json('data.id');

        /** @var BookingQuestionPresetSyncService $sync */
        $sync = app(BookingQuestionPresetSyncService::class);

        $custom = [[
            'title' => 'Custom note',
            'question_type' => 'single_choice',
            'is_required' => false,
            'is_active' => true,
            'options' => [[
                'label' => 'Yes',
                'linked_booking_service_id' => $addon->id,
                'is_active' => true,
            ]],
        ]];

        $sync->syncServiceQuestions($serviceA, [$presetId, $presetBId], $custom);
        $sync->syncServiceQuestions($serviceB, [$presetId], $custom);

        $titlesA = BookingServiceQuestion::query()
            ->where('booking_service_id', $serviceA->id)
            ->orderBy('sort_order')
            ->pluck('title')
            ->all();
        $this->assertSame(['Shape?', 'Polish?', 'Custom note'], $titlesA);

        $this->actingAs($user)->putJson('/api/admin/booking/question-presets/'.$presetId, [
            'name' => 'Nail add-ons',
            'is_active' => true,
            'questions' => [
                [
                    'title' => 'Shape updated?',
                    'question_type' => 'single_choice',
                    'is_required' => true,
                    'is_active' => true,
                    'options' => [
                        [
                            'label' => 'Square',
                            'linked_booking_service_id' => $addon->id,
                            'is_active' => true,
                        ],
                    ],
                ],
            ],
        ])->assertOk();

        $titlesAAfter = BookingServiceQuestion::query()
            ->where('booking_service_id', $serviceA->id)
            ->orderBy('sort_order')
            ->get(['title', 'question_preset_id']);

        $this->assertSame(
            ['Shape updated?', 'Polish?', 'Custom note'],
            $titlesAAfter->pluck('title')->all()
        );
        $this->assertNull($titlesAAfter->firstWhere('title', 'Custom note')?->question_preset_id);
        $this->assertSame($presetId, (int) $titlesAAfter->firstWhere('title', 'Shape updated?')?->question_preset_id);
        $this->assertSame($presetBId, (int) $titlesAAfter->firstWhere('title', 'Polish?')?->question_preset_id);

        $titlesBAfter = BookingServiceQuestion::query()
            ->where('booking_service_id', $serviceB->id)
            ->orderBy('sort_order')
            ->pluck('title')
            ->all();
        $this->assertSame(['Shape updated?', 'Custom note'], $titlesBAfter);
    }

    public function test_detach_removes_only_that_presets_rows(): void
    {
        $user = $this->actor();
        $addon = $this->service('Addon');
        $service = $this->service('Main');

        $presetA = $this->actingAs($user)->postJson('/api/admin/booking/question-presets', [
            'name' => 'Preset A',
            'questions' => [[
                'title' => 'From A',
                'question_type' => 'single_choice',
                'options' => [['label' => 'X', 'linked_booking_service_id' => $addon->id]],
            ]],
        ])->json('data.id');

        $presetB = $this->actingAs($user)->postJson('/api/admin/booking/question-presets', [
            'name' => 'Preset B',
            'questions' => [[
                'title' => 'From B',
                'question_type' => 'single_choice',
                'options' => [['label' => 'Y', 'linked_booking_service_id' => $addon->id]],
            ]],
        ])->json('data.id');

        $sync = app(BookingQuestionPresetSyncService::class);
        $sync->syncServiceQuestions($service, [(int) $presetA, (int) $presetB], [[
            'title' => 'Custom',
            'question_type' => 'single_choice',
            'options' => [['label' => 'Z', 'linked_booking_service_id' => $addon->id]],
        ]]);

        $sync->syncServiceQuestions($service, [(int) $presetB], [[
            'title' => 'Custom',
            'question_type' => 'single_choice',
            'options' => [['label' => 'Z', 'linked_booking_service_id' => $addon->id]],
        ]]);

        $this->assertSame(
            ['From B', 'Custom'],
            BookingServiceQuestion::query()
                ->where('booking_service_id', $service->id)
                ->orderBy('sort_order')
                ->pluck('title')
                ->all()
        );
        $this->assertFalse(
            $service->questionPresets()->where('booking_question_presets.id', $presetA)->exists()
        );
    }

    private function actor(): User
    {
        $role = Role::create([
            'name' => 'booking-question-preset-'.uniqid(),
            'is_active' => true,
            'is_system' => false,
        ]);
        foreach ([
            'booking.services.view',
            'booking.services.create',
            'booking.services.update',
            'booking.services.delete',
            'booking.question_presets.view',
            'booking.question_presets.create',
            'booking.question_presets.update',
            'booking.question_presets.delete',
        ] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->attach($permission);
        }
        $user = User::factory()->create();
        $user->roles()->attach($role);

        return $user;
    }

    private function service(string $name): BookingService
    {
        return BookingService::create([
            'name' => $name,
            'service_type' => 'standard',
            'duration_min' => 30,
            'service_price' => 10,
            'deposit_amount' => 0,
            'buffer_min' => 0,
            'is_active' => true,
        ]);
    }
}
