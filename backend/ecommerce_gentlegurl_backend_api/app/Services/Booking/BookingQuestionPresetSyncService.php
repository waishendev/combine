<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingQuestionPreset;
use App\Models\Booking\BookingQuestionPresetOption;
use App\Models\Booking\BookingQuestionPresetQuestion;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestion;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BookingQuestionPresetSyncService
{
    public function __construct(
        private readonly BookingServiceProductLinkService $productLinkService,
    ) {
    }

    /**
     * Replace preset definition questions from payload.
     *
     * @param  list<array<string, mixed>>  $questions
     */
    public function syncPresetQuestions(BookingQuestionPreset $preset, array $questions): void
    {
        $preset->questions()->each(function (BookingQuestionPresetQuestion $question) {
            $question->options()->delete();
            $question->delete();
        });

        $linkedServiceIds = collect($questions)
            ->flatMap(fn ($questionPayload) => $questionPayload['options'] ?? [])
            ->map(fn ($optionPayload) => (int) ($optionPayload['linked_booking_service_id'] ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $linkedServices = BookingService::query()
            ->whereIn('id', $linkedServiceIds)
            ->get(['id', 'name', 'cn_name', 'duration_min', 'service_price'])
            ->keyBy('id');

        foreach ($questions as $index => $questionPayload) {
            $question = $preset->questions()->create([
                'title' => (string) ($questionPayload['title'] ?? ''),
                'cn_title' => trim((string) ($questionPayload['cn_title'] ?? '')) ?: null,
                'description' => $questionPayload['description'] ?? null,
                'cn_description' => trim((string) ($questionPayload['cn_description'] ?? '')) ?: null,
                'question_type' => (string) ($questionPayload['question_type'] ?? 'single_choice'),
                'sort_order' => $index,
                'is_required' => (bool) ($questionPayload['is_required'] ?? false),
                'is_active' => (bool) ($questionPayload['is_active'] ?? true),
            ]);

            foreach (($questionPayload['options'] ?? []) as $optionIndex => $optionPayload) {
                $linkedServiceId = (int) ($optionPayload['linked_booking_service_id'] ?? 0);
                $linkedService = $linkedServiceId > 0 ? $linkedServices->get($linkedServiceId) : null;
                $question->options()->create([
                    'label' => trim((string) ($optionPayload['label'] ?? '')) ?: (string) optional($linkedService)->name,
                    'cn_label' => trim((string) ($optionPayload['cn_label'] ?? '')) ?: null,
                    'linked_booking_service_id' => $linkedServiceId ?: null,
                    'extra_duration_min' => $linkedService
                        ? (int) $linkedService->duration_min
                        : max(0, (int) ($optionPayload['extra_duration_min'] ?? 0)),
                    'extra_price' => $linkedService
                        ? max(0, (float) $linkedService->service_price)
                        : max(0, (float) ($optionPayload['extra_price'] ?? 0)),
                    'sort_order' => $optionIndex,
                    'is_active' => (bool) ($optionPayload['is_active'] ?? true),
                    'allow_quantity' => (bool) ($optionPayload['allow_quantity'] ?? true),
                ]);
            }
        }
    }

    /**
     * @param  list<int>  $presetIds  Ordered preset ids for this service.
     * @param  list<array<string, mixed>>  $customQuestions
     */
    public function syncServiceQuestions(BookingService $service, array $presetIds, array $customQuestions): void
    {
        $orderedPresetIds = collect($presetIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        DB::table('booking_service_question_presets')
            ->where('booking_service_id', $service->id)
            ->delete();

        $now = now();
        $rows = [];
        foreach ($orderedPresetIds as $index => $presetId) {
            $rows[] = [
                'booking_service_id' => $service->id,
                'booking_question_preset_id' => $presetId,
                'sort_order' => $index,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        if ($rows !== []) {
            DB::table('booking_service_question_presets')->insert($rows);
        }

        $this->rematerializeServiceQuestions($service, $customQuestions);
    }

    /**
     * Rebuild preset-sourced questions for every service attached to this preset.
     * Custom questions on those services are preserved.
     */
    public function syncPresetToAttachedServices(BookingQuestionPreset $preset, bool $syncLinkedProducts = true): void
    {
        $serviceIds = DB::table('booking_service_question_presets')
            ->where('booking_question_preset_id', $preset->id)
            ->pluck('booking_service_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($serviceIds === []) {
            return;
        }

        $services = BookingService::query()
            ->whereIn('id', $serviceIds)
            ->with(['linkedBookingProduct', 'questions.options'])
            ->get();

        foreach ($services as $service) {
            $customs = $this->extractCustomQuestionPayloads($service);
            $this->rematerializeServiceQuestions($service, $customs);

            if ($syncLinkedProducts && $service->linkedBookingProduct) {
                $service->load(['questions.options.linkedBookingService', 'categories:id,name,cn_name', 'linkedBookingProduct']);
                $this->productLinkService->syncProductFromService($service, $service->linkedBookingProduct);
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $customQuestions
     */
    public function rematerializeServiceQuestions(BookingService $service, array $customQuestions): void
    {
        BookingServiceQuestion::query()->where('booking_service_id', $service->id)->delete();

        $links = DB::table('booking_service_question_presets')
            ->where('booking_service_id', $service->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['booking_question_preset_id']);

        $presetIds = $links->map(fn ($link) => (int) $link->booking_question_preset_id)->all();
        $presetsById = BookingQuestionPreset::query()
            ->whereIn('id', array_values(array_unique($presetIds)))
            ->with(['questions.options'])
            ->get()
            ->keyBy('id');

        $sortOrder = 0;
        foreach ($presetIds as $presetId) {
            $preset = $presetsById->get($presetId);
            if (! $preset) {
                continue;
            }
            foreach ($preset->questions->sortBy('sort_order')->values() as $presetQuestion) {
                $this->materializePresetQuestion($service, $preset, $presetQuestion, $sortOrder);
                $sortOrder++;
            }
        }

        $this->createCustomQuestions($service, $customQuestions, $sortOrder);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function extractCustomQuestionPayloads(BookingService $service): array
    {
        $service->loadMissing('questions.options');

        return $service->questions
            ->filter(fn (BookingServiceQuestion $question) => $question->question_preset_id === null)
            ->sortBy('sort_order')
            ->values()
            ->map(fn (BookingServiceQuestion $question) => [
                'title' => (string) $question->title,
                'cn_title' => $question->cn_title,
                'description' => $question->description,
                'cn_description' => $question->cn_description,
                'question_type' => (string) $question->question_type,
                'is_required' => (bool) $question->is_required,
                'is_active' => (bool) $question->is_active,
                'options' => $question->options->sortBy('sort_order')->values()->map(fn ($option) => [
                    'label' => (string) $option->label,
                    'cn_label' => $option->cn_label,
                    'linked_booking_service_id' => $option->linked_booking_service_id,
                    'extra_duration_min' => (int) $option->extra_duration_min,
                    'extra_price' => (float) $option->extra_price,
                    'is_active' => (bool) $option->is_active,
                    'allow_quantity' => (bool) ($option->allow_quantity ?? true),
                ])->all(),
            ])
            ->all();
    }

    private function materializePresetQuestion(
        BookingService $service,
        BookingQuestionPreset $preset,
        BookingQuestionPresetQuestion $presetQuestion,
        int $sortOrder,
    ): void {
        $question = BookingServiceQuestion::query()->create([
            'booking_service_id' => $service->id,
            'question_preset_id' => $preset->id,
            'source_preset_question_id' => $presetQuestion->id,
            'title' => (string) $presetQuestion->title,
            'cn_title' => $presetQuestion->cn_title,
            'description' => $presetQuestion->description,
            'cn_description' => $presetQuestion->cn_description,
            'question_type' => (string) $presetQuestion->question_type,
            'sort_order' => $sortOrder,
            'is_required' => (bool) $presetQuestion->is_required,
            'is_active' => (bool) $presetQuestion->is_active,
        ]);

        foreach ($presetQuestion->options->sortBy('sort_order')->values() as $optionIndex => $option) {
            /** @var BookingQuestionPresetOption $option */
            $question->options()->create([
                'label' => (string) $option->label,
                'cn_label' => $option->cn_label,
                'linked_booking_service_id' => $option->linked_booking_service_id,
                'extra_duration_min' => (int) $option->extra_duration_min,
                'extra_price' => (float) $option->extra_price,
                'sort_order' => $optionIndex,
                'is_active' => (bool) $option->is_active,
                'allow_quantity' => (bool) ($option->allow_quantity ?? true),
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $customQuestions
     */
    private function createCustomQuestions(BookingService $service, array $customQuestions, int $startingSortOrder): void
    {
        $linkedServiceIds = collect($customQuestions)
            ->flatMap(fn ($questionPayload) => $questionPayload['options'] ?? [])
            ->map(fn ($optionPayload) => (int) ($optionPayload['linked_booking_service_id'] ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $linkedServices = BookingService::query()
            ->whereIn('id', $linkedServiceIds)
            ->get(['id', 'name', 'cn_name', 'duration_min', 'service_price'])
            ->keyBy('id');

        foreach ($customQuestions as $offset => $questionPayload) {
            $question = BookingServiceQuestion::query()->create([
                'booking_service_id' => $service->id,
                'question_preset_id' => null,
                'source_preset_question_id' => null,
                'title' => (string) ($questionPayload['title'] ?? ''),
                'cn_title' => trim((string) ($questionPayload['cn_title'] ?? '')) ?: null,
                'description' => $questionPayload['description'] ?? null,
                'cn_description' => trim((string) ($questionPayload['cn_description'] ?? '')) ?: null,
                'question_type' => (string) ($questionPayload['question_type'] ?? 'single_choice'),
                'sort_order' => $startingSortOrder + $offset,
                'is_required' => (bool) ($questionPayload['is_required'] ?? false),
                'is_active' => (bool) ($questionPayload['is_active'] ?? true),
            ]);

            foreach (($questionPayload['options'] ?? []) as $optionIndex => $optionPayload) {
                $linkedServiceId = (int) ($optionPayload['linked_booking_service_id'] ?? 0);
                $linkedService = $linkedServiceId > 0 ? $linkedServices->get($linkedServiceId) : null;
                $question->options()->create([
                    'label' => trim((string) ($optionPayload['label'] ?? '')) ?: (string) optional($linkedService)->name,
                    'cn_label' => trim((string) ($optionPayload['cn_label'] ?? '')) ?: null,
                    'linked_booking_service_id' => $linkedServiceId ?: null,
                    'extra_duration_min' => $linkedService
                        ? (int) $linkedService->duration_min
                        : max(0, (int) ($optionPayload['extra_duration_min'] ?? 0)),
                    'extra_price' => $linkedService
                        ? max(0, (float) $linkedService->service_price)
                        : max(0, (float) ($optionPayload['extra_price'] ?? 0)),
                    'sort_order' => $optionIndex,
                    'is_active' => (bool) ($optionPayload['is_active'] ?? true),
                    'allow_quantity' => (bool) ($optionPayload['allow_quantity'] ?? true),
                ]);
            }
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function formatPreset(BookingQuestionPreset $preset): array
    {
        $preset->loadMissing(['questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price,price_mode,price_range_min,price_range_max']);

        return [
            'id' => (int) $preset->id,
            'name' => (string) $preset->name,
            'cn_name' => $preset->cn_name,
            'is_active' => (bool) $preset->is_active,
            'created_at' => $preset->created_at,
            'updated_at' => $preset->updated_at,
            'attached_services_count' => (int) ($preset->services_count
                ?? $preset->services()->count()),
            'questions' => $preset->questions->map(function (BookingQuestionPresetQuestion $question) {
                return [
                    'id' => (int) $question->id,
                    'title' => (string) $question->title,
                    'cn_title' => $question->cn_title,
                    'description' => $question->description,
                    'cn_description' => $question->cn_description,
                    'question_type' => (string) $question->question_type,
                    'sort_order' => (int) $question->sort_order,
                    'is_required' => (bool) $question->is_required,
                    'is_active' => (bool) $question->is_active,
                    'options' => $question->options->map(function (BookingQuestionPresetOption $option) {
                        $linked = $option->linkedBookingService;

                        return [
                            'id' => (int) $option->id,
                            'label' => trim((string) $option->label) !== ''
                                ? (string) $option->label
                                : (string) optional($linked)->name,
                            'cn_label' => trim((string) ($option->cn_label ?? '')) !== ''
                                ? (string) $option->cn_label
                                : $linked?->cn_name,
                            'linked_booking_service_id' => $option->linked_booking_service_id
                                ? (int) $option->linked_booking_service_id
                                : null,
                            'linked_booking_service_name' => $linked?->name,
                            'linked_booking_service_cn_name' => $linked?->cn_name,
                            'extra_duration_min' => $linked
                                ? (int) $linked->duration_min
                                : (int) $option->extra_duration_min,
                            'extra_price' => $linked
                                ? (float) $linked->service_price
                                : (float) $option->extra_price,
                            'linked_price_mode' => $linked ? (string) ($linked->price_mode ?? 'fixed') : null,
                            'linked_price_range_min' => $linked && $linked->price_range_min !== null
                                ? (float) $linked->price_range_min
                                : null,
                            'linked_price_range_max' => $linked && $linked->price_range_max !== null
                                ? (float) $linked->price_range_max
                                : null,
                            'sort_order' => (int) $option->sort_order,
                            'is_active' => (bool) $option->is_active,
                            'allow_quantity' => (bool) ($option->allow_quantity ?? true),
                        ];
                    })->values()->all(),
                ];
            })->values()->all(),
        ];
    }

    /**
     * @return list<int>
     */
    public function orderedPresetIdsForService(BookingService $service): array
    {
        return DB::table('booking_service_question_presets')
            ->where('booking_service_id', $service->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('booking_question_preset_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, BookingQuestionPreset>|iterable<BookingQuestionPreset>  $presets
     * @return list<int>
     */
    public function orderedPresetIds($presets): array
    {
        return collect($presets)
            ->sortBy(fn (BookingQuestionPreset $preset) => (int) ($preset->pivot->sort_order ?? 0))
            ->values()
            ->map(fn (BookingQuestionPreset $preset) => (int) $preset->id)
            ->all();
    }
}
