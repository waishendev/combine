<?php

namespace Tests\Feature;

use App\Models\Booking\BookingQuestionPreset;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingQuestionPresetTest extends TestCase
{
    use RefreshDatabase;

    public function test_copied_questions_are_independent_from_preset_edits_and_deletion(): void
    {
        $preset = BookingQuestionPreset::query()->create([
            'name' => 'Nail Shape', 'title' => 'Preferred shape?', 'cn_title' => '喜欢的形状？',
            'description' => 'Choose one', 'cn_description' => '请选择', 'question_type' => 'single_choice',
            'is_required' => true, 'is_active' => true,
        ]);
        $preset->options()->createMany([
            ['label' => 'Round', 'cn_label' => '圆形', 'sort_order' => 0, 'is_active' => true, 'allow_quantity' => false],
            ['label' => 'Square', 'cn_label' => '方形', 'sort_order' => 1, 'is_active' => true, 'allow_quantity' => true],
        ]);

        $service = BookingService::query()->create([
            'name' => 'Manicure', 'service_type' => 'standard', 'duration_min' => 30,
            'service_price' => 50, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true,
        ]);
        $question = BookingServiceQuestion::query()->create([
            'booking_service_id' => $service->id, 'title' => $preset->title, 'cn_title' => $preset->cn_title,
            'description' => $preset->description, 'cn_description' => $preset->cn_description,
            'question_type' => $preset->question_type, 'sort_order' => 0,
            'is_required' => $preset->is_required, 'is_active' => $preset->is_active,
        ]);
        foreach ($preset->options as $option) {
            $question->options()->create($option->only(['label', 'cn_label', 'sort_order', 'is_active', 'allow_quantity']) + [
                'extra_duration_min' => 0, 'extra_price' => 0,
            ]);
        }

        $preset->update(['title' => 'Changed future template']);
        $preset->options()->first()->update(['label' => 'Oval']);
        $preset->delete();

        $this->assertDatabaseHas('booking_service_questions', ['id' => $question->id, 'title' => 'Preferred shape?', 'cn_title' => '喜欢的形状？']);
        $this->assertDatabaseHas('booking_service_question_options', ['booking_service_question_id' => $question->id, 'label' => 'Round', 'cn_label' => '圆形']);
        $this->assertSame(['Round', 'Square'], $question->options()->pluck('label')->all());
    }

    public function test_preset_options_preserve_order_and_flags_without_service_linkage(): void
    {
        $preset = BookingQuestionPreset::query()->create([
            'name' => 'Removal', 'title' => 'Need removal?', 'question_type' => 'multi_choice',
            'is_required' => false, 'is_active' => false,
        ]);
        $preset->options()->createMany([
            ['label' => 'Gel', 'sort_order' => 1, 'is_active' => false, 'allow_quantity' => true],
            ['label' => 'Acrylic', 'sort_order' => 0, 'is_active' => true, 'allow_quantity' => false],
        ]);

        $this->assertSame(['Acrylic', 'Gel'], $preset->options()->pluck('label')->all());
        $this->assertFalse($preset->is_active);
        $this->assertFalse($preset->options()->first()->allow_quantity);
        $this->assertFalse(\Schema::hasColumn('booking_question_preset_options', 'linked_booking_service_id'));
    }
}
