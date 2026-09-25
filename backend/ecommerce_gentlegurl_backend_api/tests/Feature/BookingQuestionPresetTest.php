<?php

namespace Tests\Feature;

use App\Models\Booking\BookingQuestionPreset;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionPresetAssignment;
use App\Models\Ecommerce\StoreLocation;
use App\Models\User;
use App\Http\Controllers\Admin\Booking\QuestionPresetController;
use App\Services\StoreLocationAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BookingQuestionPresetTest extends TestCase
{
    use RefreshDatabase;

    public function test_service_assignment_remains_live_and_removal_does_not_delete_master(): void
    {
        $preset = BookingQuestionPreset::query()->create([
            'name' => 'Shared master', 'title' => 'Original title', 'question_type' => 'single_choice',
            'is_required' => true, 'is_active' => true,
        ]);
        $question = $preset->questions()->create([
            'title' => 'Original title', 'question_type' => 'single_choice', 'sort_order' => 0,
            'is_required' => true, 'is_active' => true,
        ]);
        $question->options()->create(['booking_question_preset_id' => $preset->id, 'label' => 'Original option', 'sort_order' => 0]);
        $service = BookingService::query()->create([
            'name' => 'Manicure', 'service_type' => 'standard', 'duration_min' => 30,
            'service_price' => 50, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true,
        ]);
        $assignment = BookingServiceQuestionPresetAssignment::query()->create([
            'booking_service_id' => $service->id,
            'booking_question_preset_question_id' => $question->id,
            'sort_order' => 0,
        ]);

        $question->update(['title' => 'Updated everywhere']);
        $question->options()->first()->update(['label' => 'Updated option']);

        $this->assertSame('Updated everywhere', $assignment->fresh()->question->title);
        $this->assertSame('Updated option', $assignment->fresh()->question->options->first()->label);
        $this->assertDatabaseMissing('booking_service_questions', ['booking_service_id' => $service->id]);

        $assignment->delete();
        $this->assertDatabaseHas('booking_question_preset_questions', ['id' => $question->id, 'title' => 'Updated everywhere']);
    }

    public function test_linked_service_and_null_link_are_supported_with_option_flags(): void
    {
        $linked = BookingService::query()->create([
            'name' => 'Gel removal', 'service_type' => 'standard', 'duration_min' => 15,
            'service_price' => 20, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true,
        ]);
        $preset = BookingQuestionPreset::query()->create([
            'name' => 'Removal', 'title' => 'Need removal?', 'question_type' => 'multi_choice',
            'is_required' => false, 'is_active' => false,
        ]);
        $question = $preset->questions()->create([
            'title' => 'Need removal?', 'question_type' => 'multi_choice', 'sort_order' => 0,
            'is_required' => false, 'is_active' => false,
        ]);
        $question->options()->createMany([
            ['booking_question_preset_id' => $preset->id, 'label' => 'Gel', 'linked_booking_service_id' => $linked->id, 'sort_order' => 1, 'is_active' => false, 'allow_quantity' => true],
            ['booking_question_preset_id' => $preset->id, 'label' => 'None', 'linked_booking_service_id' => null, 'sort_order' => 0, 'is_active' => true, 'allow_quantity' => false],
        ]);

        $this->assertSame(['None', 'Gel'], $question->options()->pluck('label')->all());
        $this->assertNull($question->options()->first()->linked_booking_service_id);
        $this->assertSame($linked->id, $question->options()->last()->linkedBookingService->id);
        $this->assertFalse($question->options()->first()->allow_quantity);
    }

    public function test_linked_service_outside_users_branch_scope_is_rejected(): void
    {
        $allowedBranch = $this->branch('ALLOWED');
        $otherBranch = $this->branch('OTHER');
        $user = User::factory()->create();
        $user->storeLocations()->attach($allowedBranch);
        $linked = BookingService::query()->create([
            'name' => 'Other tenant service', 'service_type' => 'standard', 'duration_min' => 15,
            'service_price' => 20, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true,
        ]);
        $linked->storeLocations()->attach($otherBranch);
        $request = Request::create('/admin/booking/question-presets', 'POST', [
            'name' => 'Unsafe', 'is_active' => true,
            'questions' => [[
                'title' => 'Question', 'question_type' => 'single_choice',
                'options' => [['label' => 'Option', 'linked_booking_service_id' => $linked->id]],
            ]],
        ]);
        $request->setUserResolver(fn () => $user);
        $method = new \ReflectionMethod(QuestionPresetController::class, 'validated');
        $controller = new QuestionPresetController(app(StoreLocationAccessService::class));

        $this->expectException(ValidationException::class);
        $method->invoke($controller, $request);
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::query()->create([
            'name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x',
            'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_booking_available' => true,
        ]);
    }
}
