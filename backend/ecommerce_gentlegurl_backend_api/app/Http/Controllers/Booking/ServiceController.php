<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function categories()
    {
        $categories = BookingServiceCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respond($categories->map(fn (BookingServiceCategory $category) => [
            'id' => (int) $category->id,
            'name' => $category->name,
            'cn_name' => $category->cn_name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image_path' => $category->image_path,
            'image_url' => $category->image_url,
            'is_active' => (bool) $category->is_active,
            'show_in_pos_filter' => (bool) ($category->show_in_pos_filter ?? true),
            'sort_order' => (int) $category->sort_order,
        ])->values());
    }

    public function index(Request $request)
    {
        $services = BookingService::query()
            ->with(['categories' => fn ($query) => $query->where('is_active', true)])
            ->where('is_active', true)
            ->when($request->filled('category_id'), function ($query) use ($request) {
                $categoryId = (int) $request->integer('category_id');
                if ($categoryId > 0) {
                    $query->whereHas('categories', fn ($categoryQuery) => $categoryQuery
                        ->where('booking_service_categories.id', $categoryId)
                        ->where('is_active', true));
                }
            })
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'cn_name',
                'description',
                'service_type',
                'service_price',
                'price',
                'price_mode',
                'price_range_min',
                'price_range_max',
                'is_package_eligible',
                'allow_photo_upload',
                'duration_min',
                'deposit_amount',
                'buffer_min',
                'is_active',
                'image_path',
            ]);

        // Batch staff for the list path only — same filters/order as per-service mapService lookups.
        $staffByServiceId = $this->loadStaffPayloadsByServiceIds(
            $services->pluck('id')->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all()
        );

        $payload = $services->map(
            fn (BookingService $service) => $this->mapService($service, false, $staffByServiceId[(int) $service->id] ?? [])
        )->values();

        return $this->respond($payload);
    }

    public function show(int $id)
    {
        $service = BookingService::query()->with([
            'primarySlots',
            'categories' => fn ($query) => $query->where('is_active', true),
            'questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price,price,price_mode,price_range_min,price_range_max,image_path,description,service_type,deposit_amount',
        ])->findOrFail($id);

        return $this->respond($this->mapService($service, true));
    }

    /**
     * Load allowed active staff payloads for many services in two queries.
     * Mirrors mapService staff filters: active pivot rows + active staff, ordered by name.
     *
     * @param  list<int>  $serviceIds
     * @return array<int, list<array{id:int,name:mixed,position:mixed,description:mixed,avatar_path:mixed,avatar_url:mixed}>>
     */
    private function loadStaffPayloadsByServiceIds(array $serviceIds): array
    {
        $serviceIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds), fn (int $id) => $id > 0)));
        if ($serviceIds === []) {
            return [];
        }

        $pivotRows = BookingServiceStaff::query()
            ->whereIn('service_id', $serviceIds)
            ->where('is_active', true)
            ->get(['service_id', 'staff_id']);

        $staffIdsByService = [];
        $allStaffIds = [];
        foreach ($pivotRows as $row) {
            $serviceId = (int) $row->service_id;
            $staffId = (int) $row->staff_id;
            if ($staffId <= 0) {
                continue;
            }
            $staffIdsByService[$serviceId][$staffId] = $staffId;
            $allStaffIds[$staffId] = $staffId;
        }

        $staffPayloadById = [];
        if ($allStaffIds !== []) {
            $staffPayloadById = Staff::query()
                ->whereIn('id', array_values($allStaffIds))
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'position', 'description', 'avatar_path'])
                ->mapWithKeys(function (Staff $staff) {
                    $payload = $this->mapStaffPayload($staff);

                    return [(int) $staff->id => $payload];
                })
                ->all();
        }

        // staffPayloadById preserves Staff::orderBy('name') insertion order.
        $result = [];
        foreach ($serviceIds as $serviceId) {
            $allowed = $staffIdsByService[$serviceId] ?? [];
            $staffs = [];
            foreach ($staffPayloadById as $staffId => $payload) {
                if (isset($allowed[$staffId])) {
                    $staffs[] = $payload;
                }
            }
            $result[$serviceId] = $staffs;
        }

        return $result;
    }

    /**
     * @return array{id:int,name:mixed,position:mixed,description:mixed,avatar_path:mixed,avatar_url:mixed}
     */
    private function mapStaffPayload(Staff $staff): array
    {
        return [
            'id' => (int) $staff->id,
            'name' => $staff->name,
            'position' => $staff->position,
            'description' => $staff->description,
            'avatar_path' => $staff->avatar_path,
            'avatar_url' => $staff->avatar_url,
        ];
    }

    /**
     * @param  list<array{id:int,name:mixed,position:mixed,description:mixed,avatar_path:mixed,avatar_url:mixed}>|null  $preloadedStaffs
     */
    private function mapService(BookingService $service, bool $includeDescription, ?array $preloadedStaffs = null): array
    {
        if ($preloadedStaffs !== null) {
            $staffs = $preloadedStaffs;
        } else {
            $staffRows = BookingServiceStaff::query()
                ->where('service_id', $service->id)
                ->where('is_active', true)
                ->get(['staff_id']);

            $staffIds = $staffRows->pluck('staff_id')->unique()->values()->all();
            $staffs = Staff::query()
                ->whereIn('id', $staffIds)
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'position', 'description', 'avatar_path'])
                ->map(fn (Staff $staff) => $this->mapStaffPayload($staff))
                ->values()
                ->all();
        }

        $primarySlots = $service->relationLoaded('primarySlots')
            ? $service->primarySlots
            : $service->primarySlots()->where('is_active', true)->get();

        $payload = [
            'id' => (int) $service->id,
            'name' => $service->name,
            'cn_name' => $service->cn_name,
            'service_type' => $service->service_type,
            'duration_min' => (int) $service->duration_min,
            'duration_minutes' => (int) $service->duration_min,
            'service_price' => (float) $service->service_price,
            'price' => (float) ($service->price ?? $service->service_price),
            'price_mode' => (string) ($service->price_mode ?? 'fixed'),
            'price_range_min' => $service->price_range_min !== null ? (float) $service->price_range_min : null,
            'price_range_max' => $service->price_range_max !== null ? (float) $service->price_range_max : null,
            'is_package_eligible' => (bool) ($service->is_package_eligible ?? true),
            'allow_photo_upload' => (bool) ($service->allow_photo_upload ?? false),
            'deposit_amount' => (float) $service->deposit_amount,
            'buffer_min' => (int) $service->buffer_min,
            'is_active' => (bool) $service->is_active,
            'image_path' => $service->image_path,
            'image_url' => $service->image_url,
            'primary_slots' => $primarySlots
                ->where('is_active', true)
                ->sortBy('sort_order')
                ->values()
                ->map(fn ($slot) => [
                    'id' => (int) $slot->id,
                    'start_time' => substr((string) $slot->start_time, 0, 5),
                    'sort_order' => (int) $slot->sort_order,
                    'is_active' => (bool) $slot->is_active,
                ])->all(),
            'staffs' => $staffs,
            'allowed_staffs' => $staffs,
            'allowed_staff_count' => count($staffs),
            'allowed_staff_names' => collect($staffs)->pluck('name')->filter()->values()->all(),
            ...$this->mapCategoryFields($service),
            'questions' => $service->questions()
                ->where('is_active', true)
                ->with(['options' => fn ($q) => $q
                    ->where('is_active', true)
                    ->with('linkedBookingService:id,name,cn_name,duration_min,service_price,price,price_mode,price_range_min,price_range_max,image_path,description,service_type,deposit_amount')
                    ->orderBy('sort_order')
                    ->orderBy('id')])
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(fn ($question) => [
                    'id' => (int) $question->id,
                    'title' => (string) $question->title,
                    'cn_title' => $question->cn_title,
                    'description' => $question->description,
                    'cn_description' => $question->cn_description,
                    'question_type' => (string) $question->question_type,
                    'is_required' => (bool) $question->is_required,
                    'sort_order' => (int) $question->sort_order,
                    'options' => $question->options->map(function ($option) {
                        $linkedService = $option->linkedBookingService;
                        return [
                            'id' => (int) $option->id,
                            'label' => trim((string) $option->label) !== '' ? (string) $option->label : (string) optional($linkedService)->name,
                            'cn_label' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $linkedService?->cn_name,
                            'linked_booking_service_id' => $option->linked_booking_service_id ? (int) $option->linked_booking_service_id : null,
                            'extra_duration_min' => $linkedService ? (int) $linkedService->duration_min : (int) $option->extra_duration_min,
                            'extra_price' => $linkedService ? (float) $linkedService->service_price : (float) $option->extra_price,
                            'linked_cn_name' => $linkedService?->cn_name,
                            'linked_price_mode' => $linkedService ? (string) ($linkedService->price_mode ?? 'fixed') : null,
                            'linked_price_range_min' => $linkedService && $linkedService->price_range_min !== null ? (float) $linkedService->price_range_min : null,
                            'linked_price_range_max' => $linkedService && $linkedService->price_range_max !== null ? (float) $linkedService->price_range_max : null,
                            'sort_order' => (int) $option->sort_order,
                            'is_active' => (bool) $option->is_active,
                            'image_path' => $linkedService?->image_path,
                            'image_url' => $linkedService?->image_url,
                            'linked_description' => $linkedService?->description,
                            'linked_service_type' => $linkedService?->service_type,
                            'linked_deposit_amount' => $linkedService ? (float) ($linkedService->deposit_amount ?? 0) : null,
                        ];
                    })->values()->all(),
                ])->values()->all(),
        ];

        if ($includeDescription) {
            $payload['description'] = $service->description;
        }

        return $payload;
    }

    private function mapCategoryFields(BookingService $service): array
    {
        $categories = $service->relationLoaded('categories')
            ? $service->categories->sortBy('name')->values()
            : collect();

        $categoryPayload = $categories->map(fn (BookingServiceCategory $category) => [
            'id' => (int) $category->id,
            'name' => $category->name,
            'cn_name' => $category->cn_name,
        ])->all();

        $firstCategory = $categoryPayload[0] ?? null;

        return [
            'category_id' => $firstCategory ? (int) $firstCategory['id'] : null,
            'category_ids' => array_map(fn (array $category) => (int) $category['id'], $categoryPayload),
            'category' => $firstCategory,
            'categories' => $categoryPayload,
        ];
    }
}
