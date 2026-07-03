<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use App\Models\Booking\BookingServicePrimarySlot;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionOption;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use App\Services\Booking\BookingServiceProductLinkService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ServiceController extends Controller
{
    public function __construct(
        private readonly BookingServiceProductLinkService $productLinkService,
    ) {
    }

    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 20);
        $perPage = max(1, min(200, $perPage));

        $services = BookingService::query()
            ->with(['allowedStaffs:id,name', 'primarySlots', 'questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price', 'categories:id,name,cn_name', 'linkedBookingProduct:id,name,cn_name,price,price_mode,price_range_min,price_range_max,is_active,image_path'])
            ->when($request->filled('name'), function ($query) use ($request) {
                $term = '%' . trim((string) $request->get('name')) . '%';
                $query->where(function ($inner) use ($term) {
                    $inner->where('name', 'like', $term)
                        ->orWhere('cn_name', 'like', $term);
                });
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $isActive = filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($isActive !== null) {
                    $query->where('is_active', $isActive);
                }
            })
            ->when($request->filled('category_id'), function ($query) use ($request) {
                $rawCategoryId = strtolower(trim((string) $request->get('category_id')));
                if ($rawCategoryId === 'none') {
                    $query->whereDoesntHave('categories');

                    return;
                }

                $categoryId = (int) $request->integer('category_id');
                if ($categoryId > 0) {
                    $query->whereHas('categories', fn ($categoryQuery) => $categoryQuery->where('booking_service_categories.id', $categoryId));
                }
            })
            ->latest()
            ->paginate($perPage);

        $services->getCollection()->transform(fn (BookingService $service) => $this->formatService($service));

        return $this->respond($services);
    }

    public function show(int $id)
    {
        $service = BookingService::query()
            ->with(['allowedStaffs:id,name,position,avatar_path', 'primarySlots', 'questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price', 'categories:id,name,cn_name', 'linkedBookingProduct:id,name,cn_name,price,price_mode,price_range_min,price_range_max,is_active,image_path'])
            ->findOrFail($id);

        return $this->respond($this->formatService($service));
    }

    public function store(Request $request)
    {
        if ($request->filled('questions_json') && ! $request->filled('questions')) {
            $decoded = json_decode((string) $request->input('questions_json'), true);
            if (is_array($decoded)) {
                $request->merge(['questions' => $decoded]);
            }
        }

        $data = $request->validate([
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_service_categories,id'],
            'category_id' => ['nullable', 'integer', 'exists:booking_service_categories,id'],
            'name' => ['required', 'string'],
            'cn_name' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['nullable', 'numeric', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'price_mode' => ['nullable', 'in:fixed,range'],
            'price_range_min' => ['nullable', 'numeric', 'min:0'],
            'price_range_max' => ['nullable', 'numeric', 'min:0'],
            'duration_min' => ['required', 'integer', 'min:1'],
            'deposit_amount' => ['required', 'numeric', 'min:0'],
            'buffer_min' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'allow_photo_upload' => ['nullable', 'boolean'],
            'rules_json' => ['nullable', 'array'],
            'allowed_staff_ids' => ['required', 'array', 'min:1'],
            'allowed_staff_ids.*' => ['integer', 'distinct'],
            'primary_slots' => ['nullable', 'array'],
            'primary_slots.*' => ['date_format:H:i'],
            'questions' => ['nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.cn_description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions_json' => ['nullable', 'string'],
            'create_linked_product' => ['nullable', 'boolean'],
            'linked_booking_product_id' => ['nullable', 'integer', 'exists:booking_products,id'],
        ]);
        $data['service_price'] = $data['service_price'] ?? 0;
        $data['price'] = $data['price'] ?? $data['service_price'];
        $data['price_mode'] = $data['price_mode'] ?? 'fixed';
        if ($data['price_mode'] === 'range') {
            $data['price_range_min'] = $data['price_range_min'] ?? 0;
            $data['price_range_max'] = $data['price_range_max'] ?? 0;
        } else {
            $data['price_range_min'] = null;
            $data['price_range_max'] = null;
        }
        $data['is_package_eligible'] = (bool) ($data['is_package_eligible'] ?? true);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $allowedStaffIds = $this->resolveAllowedStaffIds($data['allowed_staff_ids'] ?? []);
        $primarySlots = $data['primary_slots'] ?? [];
        $questions = $data['questions'] ?? [];
        $categoryIds = $this->resolveCategoryIds($request, $data);
        $createLinkedProduct = $request->boolean('create_linked_product');
        $linkedProductId = isset($data['linked_booking_product_id']) ? (int) $data['linked_booking_product_id'] : null;
        unset($data['allowed_staff_ids'], $data['primary_slots'], $data['questions'], $data['questions_json'], $data['create_linked_product'], $data['linked_booking_product_id'], $data['category_ids'], $data['category_id']);

        $uploadedServiceImagePath = $data['image_path'] ?? null;

        try {
            $service = DB::transaction(function () use (
                $request,
                $data,
                $allowedStaffIds,
                $primarySlots,
                $questions,
                $categoryIds,
                $createLinkedProduct,
                $linkedProductId,
            ) {
                $service = BookingService::create($data);
                $this->syncCategories($service, $categoryIds);
                $this->syncAllowedStaffs($service, $allowedStaffIds);
                $this->syncPrimarySlots($service, $primarySlots);
                $this->syncQuestions($service, $questions);
                $this->productLinkService->handleCreateLink($service, $createLinkedProduct, $linkedProductId ?: null);

                BookingLog::create([
                    'actor_type' => 'ADMIN',
                    'actor_id' => optional($request->user())->id,
                    'action' => 'UPDATE_SERVICE',
                    'meta' => ['service_id' => $service->id],
                    'created_at' => now(),
                ]);

                return $service;
            });

            $this->productLinkService->commitFileCleanup();

            return $this->respond(
                $this->formatService($service->fresh([
                    'allowedStaffs:id,name,position,avatar_path',
                    'primarySlots',
                    'questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price',
                    'categories:id,name,cn_name',
                    'linkedBookingProduct:id,name,cn_name,price,price_mode,price_range_min,price_range_max,is_active,image_path',
                ])),
                'Created',
                true,
                201
            );
        } catch (ValidationException $e) {
            $this->rollbackFailedServiceSave($uploadedServiceImagePath);

            throw $e;
        } catch (\Throwable $e) {
            $this->rollbackFailedServiceSave($uploadedServiceImagePath);

            return $this->respondError(
                $this->formatServiceSaveFailureMessage($e, 'create'),
                422,
            );
        }
    }

    public function update(Request $request, int $id)
    {
        if ($request->filled('questions_json') && ! $request->filled('questions')) {
            $decoded = json_decode((string) $request->input('questions_json'), true);
            if (is_array($decoded)) {
                $request->merge(['questions' => $decoded]);
            }
        }

        $service = BookingService::findOrFail($id);
        $data = $request->validate([
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_service_categories,id'],
            'category_id' => ['nullable', 'integer', 'exists:booking_service_categories,id'],
            'name' => ['sometimes', 'string'],
            'cn_name' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['sometimes', 'numeric', 'min:0'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'price_mode' => ['sometimes', 'in:fixed,range'],
            'price_range_min' => ['nullable', 'numeric', 'min:0'],
            'price_range_max' => ['nullable', 'numeric', 'min:0'],
            'is_package_eligible' => ['sometimes', 'boolean'],
            'duration_min' => ['sometimes', 'integer', 'min:1'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'buffer_min' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'allow_photo_upload' => ['sometimes', 'boolean'],
            'rules_json' => ['nullable', 'array'],
            'allowed_staff_ids' => ['required', 'array', 'min:1'],
            'allowed_staff_ids.*' => ['integer', 'distinct'],
            'primary_slots' => ['nullable', 'array'],
            'primary_slots.*' => ['date_format:H:i'],
            'questions' => ['nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.cn_description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            'questions_json' => ['nullable', 'string'],
            'create_linked_product' => ['nullable', 'boolean'],
            'unlink_booking_product' => ['nullable', 'boolean'],
            'overwrite_linked_product' => ['nullable', 'boolean'],
            'linked_booking_product_id' => ['nullable', 'integer', 'exists:booking_products,id'],
        ]);

        $oldImagePath = $service->image_path;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        if (array_key_exists('price_mode', $data)) {
            if ($data['price_mode'] === 'range') {
                $data['price_range_min'] = $data['price_range_min'] ?? 0;
                $data['price_range_max'] = $data['price_range_max'] ?? 0;
            } else {
                $data['price_range_min'] = null;
                $data['price_range_max'] = null;
            }
        }

        $allowedStaffIds = $this->resolveAllowedStaffIds($data['allowed_staff_ids'] ?? []);
        $primarySlots = $data['primary_slots'] ?? [];
        $questions = $data['questions'] ?? [];
        $hasCategoryIdsInput = $request->has('category_ids') || $request->has('category_id');
        $categoryIds = $hasCategoryIdsInput ? $this->resolveCategoryIds($request, $data) : null;
        $createLinkedProduct = $request->boolean('create_linked_product');
        $unlinkBookingProduct = $request->boolean('unlink_booking_product');
        $overwriteLinkedProduct = $request->boolean('overwrite_linked_product');
        $hasLinkedProductIdInput = $request->has('linked_booking_product_id');
        $linkedProductId = $hasLinkedProductIdInput
            ? (($data['linked_booking_product_id'] ?? null) !== null ? (int) $data['linked_booking_product_id'] : null)
            : null;
        unset(
            $data['allowed_staff_ids'],
            $data['primary_slots'],
            $data['questions'],
            $data['questions_json'],
            $data['create_linked_product'],
            $data['unlink_booking_product'],
            $data['overwrite_linked_product'],
            $data['linked_booking_product_id'],
            $data['category_ids'],
            $data['category_id'],
        );

        $newServiceImagePath = $data['image_path'] ?? null;

        try {
            DB::transaction(function () use (
                $request,
                $service,
                $data,
                $allowedStaffIds,
                $primarySlots,
                $questions,
                $hasCategoryIdsInput,
                $categoryIds,
                $createLinkedProduct,
                $unlinkBookingProduct,
                $overwriteLinkedProduct,
                $hasLinkedProductIdInput,
                $linkedProductId,
            ) {
                $service->update($data);
                if ($hasCategoryIdsInput && $categoryIds !== null) {
                    $this->syncCategories($service, $categoryIds);
                }
                $this->syncAllowedStaffs($service, $allowedStaffIds);
                $this->syncPrimarySlots($service, $primarySlots);
                $this->syncQuestions($service, $questions);

                if ($unlinkBookingProduct || $createLinkedProduct || $hasLinkedProductIdInput) {
                    $this->productLinkService->handleUpdateLink(
                        $service,
                        $unlinkBookingProduct,
                        $createLinkedProduct,
                        $linkedProductId,
                        $hasLinkedProductIdInput,
                    );
                }

                if ($overwriteLinkedProduct) {
                    $service = $service->fresh(['linkedBookingProduct', 'questions.options.linkedBookingService']);
                    if ($service->linkedBookingProduct) {
                        $this->productLinkService->syncProductFromService($service, $service->linkedBookingProduct);
                    }
                }

                BookingLog::create([
                    'actor_type' => 'ADMIN',
                    'actor_id' => optional($request->user())->id,
                    'action' => 'UPDATE_SERVICE',
                    'meta' => ['service_id' => $service->id],
                    'created_at' => now(),
                ]);
            });

            $this->productLinkService->commitFileCleanup();

            if ($newServiceImagePath && $oldImagePath && $oldImagePath !== $newServiceImagePath && Storage::disk('public')->exists($oldImagePath)) {
                Storage::disk('public')->delete($oldImagePath);
            }

            $service = $service->fresh();

            return $this->respond($this->formatService($service->fresh([
                'allowedStaffs:id,name,position,avatar_path',
                'primarySlots',
                'questions.options.linkedBookingService:id,name,cn_name,duration_min,service_price',
                'categories:id,name,cn_name',
                'linkedBookingProduct:id,name,cn_name,price,price_mode,price_range_min,price_range_max,is_active,image_path',
            ])));
        } catch (ValidationException $e) {
            $this->rollbackFailedServiceSave($newServiceImagePath);

            throw $e;
        } catch (\Throwable $e) {
            $this->rollbackFailedServiceSave($newServiceImagePath);

            return $this->respondError(
                $this->formatServiceSaveFailureMessage($e, 'update'),
                422,
            );
        }
    }

    public function destroy(Request $request, int $id)
    {
        $service = BookingService::query()->with('linkedBookingProduct')->findOrFail($id);
    
        if (Booking::query()->where('service_id', $id)->exists()) {
            return $this->respondError(
                'This service cannot be deleted because it is already used in existing bookings. Please set it to inactive instead.',
                422
            );
        }

        $deleteLinkedProduct = $request->boolean('delete_linked_product');
        $this->productLinkService->deleteLinkedProductIfRequested($service, $deleteLinkedProduct);
    
        $service->delete();
    
        return $this->respond(null);
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_services,id'],
        ]);

        $services = BookingService::query()->whereIn('id', $validated['ids'])->get();
        $blockedServiceIds = Booking::query()
            ->whereIn('service_id', $validated['ids'])
            ->distinct()
            ->pluck('service_id');

        if ($blockedServiceIds->isNotEmpty()) {
            $names = $services
                ->whereIn('id', $blockedServiceIds->all())
                ->pluck('name')
                ->filter()
                ->values()
                ->all();

            return $this->respondError(
                __('Cannot delete: :names. These services are used in existing bookings. Set them inactive instead.', [
                    'names' => implode(', ', $names),
                ]),
                422
            );
        }

        $deletedCount = 0;
        foreach ($services as $service) {
            $service->delete();
            $deletedCount++;
        }

        return $this->respond([
            'deleted_count' => $deletedCount,
        ], __('Booking services deleted successfully.'));
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_services,id'],

            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_service_categories,id'],
            'category_id' => ['nullable', 'integer', 'exists:booking_service_categories,id'],
            'service_type' => ['nullable', 'in:premium,standard'],
            'duration_min' => ['nullable', 'integer', 'min:1'],
            'buffer_min' => ['nullable', 'integer', 'min:0'],
            'service_price' => ['nullable', 'numeric', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'price_mode' => ['nullable', 'in:fixed,range'],
            'price_range_min' => ['nullable', 'numeric', 'min:0'],
            'price_range_max' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'allow_photo_upload' => ['nullable', 'boolean'],

            'allowed_staff_ids' => ['nullable', 'array', 'min:1'],
            'allowed_staff_ids.*' => ['integer', 'distinct'],
            'primary_slots' => ['nullable', 'array'],
            'primary_slots.*' => ['date_format:H:i'],

            'questions' => ['nullable', 'array'],
            'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
            'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.cn_description' => ['nullable', 'string'],
            'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.is_active' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
            'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
            'questions.*.options.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'questions.*.options.*.is_active' => ['nullable', 'boolean'],
        ]);

        $services = BookingService::query()
            ->whereIn('id', $validated['ids'])
            ->get();

        $payload = collect($validated)->except('ids')->toArray();

        // Normalize payload bits
        $hasAllowedStaff = array_key_exists('allowed_staff_ids', $payload);
        $hasPrimarySlots = array_key_exists('primary_slots', $payload);
        $hasQuestions = array_key_exists('questions', $payload);
        $hasCategoryIds = array_key_exists('category_ids', $payload) || array_key_exists('category_id', $payload);
        $categoryIds = $hasCategoryIds ? $this->resolveCategoryIds($request, $payload) : null;
        $allowedStaffIds = $hasAllowedStaff ? $this->resolveAllowedStaffIds($payload['allowed_staff_ids'] ?? []) : null;
        $primarySlots = $hasPrimarySlots ? ($payload['primary_slots'] ?? []) : null;
        $questions = $hasQuestions ? ($payload['questions'] ?? []) : null;
        unset($payload['allowed_staff_ids'], $payload['primary_slots'], $payload['questions'], $payload['category_ids'], $payload['category_id']);

        foreach ($services as $service) {
            // Validate range mode constraints if present
            $nextPriceMode = array_key_exists('price_mode', $payload)
                ? ($payload['price_mode'] ?? null)
                : ($service->price_mode ?? 'fixed');

            if ($nextPriceMode === 'range') {
                $min = array_key_exists('price_range_min', $payload) ? $payload['price_range_min'] : $service->price_range_min;
                $max = array_key_exists('price_range_max', $payload) ? $payload['price_range_max'] : $service->price_range_max;
                $min = (float) ($min ?? 0);
                $max = (float) ($max ?? 0);

                if ($min > $max) {
                    throw ValidationException::withMessages([
                        'price_range_min' => 'Range min must be less than or equal to range max.',
                    ])->status(422);
                }
            }

            $next = $payload;

            // Keep legacy price field in sync where applicable.
            if (array_key_exists('service_price', $payload) && ! array_key_exists('price', $payload)) {
                $next['price'] = $payload['service_price'];
            }

            if (array_key_exists('price_mode', $payload)) {
                if ($payload['price_mode'] === 'range') {
                    $next['price_range_min'] = $next['price_range_min'] ?? 0;
                    $next['price_range_max'] = $next['price_range_max'] ?? 0;
                } else {
                    $next['price_range_min'] = null;
                    $next['price_range_max'] = null;
                }
            }

            if (! empty($next)) {
                $service->fill($next);
                $service->save();
            }

            if ($hasAllowedStaff && $allowedStaffIds !== null) {
                $this->syncAllowedStaffs($service, $allowedStaffIds);
            }
            if ($hasCategoryIds && $categoryIds !== null) {
                $this->syncCategories($service, $categoryIds);
            }
            if ($hasPrimarySlots && $primarySlots !== null) {
                $this->syncPrimarySlots($service, $primarySlots);
            }
            if ($hasQuestions && $questions !== null) {
                $this->syncQuestions($service, $questions);
            }
        }

        return $this->respond(
            $services->load(['allowedStaffs:id,name', 'primarySlots', 'categories:id,name,cn_name']),
            __('Services updated successfully.')
        );
    }

    public function exportCsv(Request $request)
    {
        $services = BookingService::query()
            ->with(['allowedStaffs:id', 'primarySlots', 'questions.options'])
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking services CSV export.'], 500);
        }

        $headers = [
            'id', 'name', 'cn_name', 'service_type', 'description', 'duration_min', 'service_price', 'deposit_amount', 'buffer_min',
            'price_mode', 'price_range_min', 'price_range_max', 'is_package_eligible', 'allow_photo_upload', 'is_active', 'allowed_staff_ids', 'primary_slots', 'questions_json',
        ];
        fputcsv($stream, $headers);

        foreach ($services as $service) {
            fputcsv($stream, [
                $service->id,
                $service->name,
                $service->cn_name,
                $service->service_type,
                $service->description,
                $service->duration_min,
                $service->service_price,
                $service->deposit_amount,
                $service->buffer_min,
                $service->price_mode,
                $service->price_range_min,
                $service->price_range_max,
                $service->is_package_eligible ? 'true' : 'false',
                $service->allow_photo_upload ? 'true' : 'false',
                $service->is_active ? 'true' : 'false',
                $service->allowedStaffs->pluck('id')->join('|'),
                $service->primarySlots->pluck('start_time')->map(fn ($time) => substr((string) $time, 0, 5))->join('|'),
                json_encode(
                    $service->questions
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
                            'options' => $question->options
                                ->sortBy('sort_order')
                                ->values()
                                ->map(fn (BookingServiceQuestionOption $option) => [
                                    'label' => (string) ($option->label ?? ''),
                                    'cn_label' => $option->cn_label,
                                    'linked_booking_service_id' => (int) ($option->linked_booking_service_id ?? 0),
                                    'extra_duration_min' => (int) ($option->extra_duration_min ?? 0),
                                    'extra_price' => (float) ($option->extra_price ?? 0),
                                    'is_active' => (bool) $option->is_active,
                                ])
                                ->all(),
                        ])
                        ->all(),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                ),
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-services-export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to open CSV file.'], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json(['message' => 'Invalid CSV header row.'], 422);
        }

        $headers = array_map(fn ($header) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)), $headers);
        $allowedHeaders = [
            'id', 'name', 'cn_name', 'service_type', 'description', 'duration_min', 'service_price', 'deposit_amount', 'buffer_min',
            'price_mode', 'price_range_min', 'price_range_max', 'is_package_eligible', 'allow_photo_upload', 'is_active', 'allowed_staff_ids', 'primary_slots', 'questions_json',
        ];
        $unknownHeaders = array_values(array_diff(array_filter($headers), $allowedHeaders));
        if (! empty($unknownHeaders)) {
            fclose($handle);
            return response()->json(['message' => 'Unexpected CSV headers: ' . implode(', ', $unknownHeaders)], 422);
        }

        $summary = ['totalRows' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0, 'failed' => 0, 'failedRows' => []];
        $rowNumber = 1;

        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $payload = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $payload[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            $isAllEmpty = count(array_filter($payload, fn ($value) => $value !== '')) === 0;
            if ($isAllEmpty) {
                continue;
            }

            $summary['totalRows']++;
            $allowedStaffIds = collect(explode('|', (string) ($payload['allowed_staff_ids'] ?? '')))
                ->map(fn ($id) => (int) trim($id))
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all();
            $primarySlots = collect(explode('|', (string) ($payload['primary_slots'] ?? '')))
                ->map(fn ($time) => trim($time))
                ->filter()
                ->unique()
                ->values()
                ->all();
            $questionsPayload = [];
            if (isset($payload['questions_json']) && trim((string) $payload['questions_json']) !== '') {
                $decodedQuestions = json_decode((string) $payload['questions_json'], true);
                if (! is_array($decodedQuestions)) {
                    $summary['failed']++;
                    $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => 'questions_json must be valid JSON array.'];
                    continue;
                }
                $questionsPayload = $decodedQuestions;
            }

            $raw = [
                'name' => $payload['name'] ?? null,
                'cn_name' => $payload['cn_name'] ?? null,
                'service_type' => $payload['service_type'] ?? null,
                'description' => $payload['description'] ?? null,
                'duration_min' => $payload['duration_min'] ?? null,
                'service_price' => $payload['service_price'] ?? null,
                'deposit_amount' => $payload['deposit_amount'] ?? null,
                'buffer_min' => $payload['buffer_min'] ?? null,
                'price_mode' => $payload['price_mode'] ?: 'fixed',
                'price_range_min' => $payload['price_range_min'] ?: null,
                'price_range_max' => $payload['price_range_max'] ?: null,
                'is_package_eligible' => $payload['is_package_eligible'] ?? 'true',
                'allow_photo_upload' => $payload['allow_photo_upload'] ?? 'false',
                'is_active' => $payload['is_active'] ?? 'true',
                'allowed_staff_ids' => $allowedStaffIds,
                'primary_slots' => $primarySlots,
                'questions' => $questionsPayload,
            ];

            $raw['is_active'] = filter_var((string) $raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $raw['is_package_eligible'] = filter_var((string) $raw['is_package_eligible'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $raw['allow_photo_upload'] = filter_var((string) $raw['allow_photo_upload'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:255'],
                'cn_name' => ['nullable', 'string', 'max:255'],
                'service_type' => ['required', 'in:premium,standard'],
                'description' => ['nullable', 'string'],
                'duration_min' => ['required', 'integer', 'min:1'],
                'service_price' => ['required', 'numeric', 'min:0'],
                'deposit_amount' => ['required', 'numeric', 'min:0'],
                'buffer_min' => ['nullable', 'integer', 'min:0'],
                'price_mode' => ['required', 'in:fixed,range'],
                'price_range_min' => ['nullable', 'numeric', 'min:0'],
                'price_range_max' => ['nullable', 'numeric', 'min:0'],
                'is_package_eligible' => ['required', 'boolean'],
                'allow_photo_upload' => ['required', 'boolean'],
                'is_active' => ['required', 'boolean'],
                'allowed_staff_ids' => ['required', 'array', 'min:1'],
                'allowed_staff_ids.*' => ['integer', 'exists:staffs,id'],
                'primary_slots' => ['nullable', 'array'],
                'primary_slots.*' => ['date_format:H:i'],
                'questions' => ['nullable', 'array'],
                'questions.*.title' => ['required_with:questions', 'string', 'max:255'],
                'questions.*.cn_title' => ['nullable', 'string', 'max:255'],
                'questions.*.description' => ['nullable', 'string'],
                'questions.*.cn_description' => ['nullable', 'string'],
                'questions.*.question_type' => ['required_with:questions', 'in:single_choice,multi_choice'],
                'questions.*.is_required' => ['nullable', 'boolean'],
                'questions.*.is_active' => ['nullable', 'boolean'],
                'questions.*.options' => ['nullable', 'array'],
                'questions.*.options.*.label' => ['nullable', 'string', 'max:255'],
                'questions.*.options.*.cn_label' => ['nullable', 'string', 'max:255'],
                'questions.*.options.*.linked_booking_service_id' => ['required_with:questions.*.options', 'integer', 'exists:booking_services,id'],
                'questions.*.options.*.extra_duration_min' => ['nullable', 'integer', 'min:0'],
                'questions.*.options.*.extra_price' => ['nullable', 'numeric', 'min:0'],
                'questions.*.options.*.is_active' => ['nullable', 'boolean'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $serviceId = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            try {
                DB::transaction(function () use ($serviceId, $validated, &$summary) {
                    $service = $serviceId ? BookingService::query()->find($serviceId) : null;
                    if (! $service) {
                        $service = BookingService::query()->create([
                            'name' => $validated['name'],
                            'cn_name' => $validated['cn_name'] ?? null,
                            'service_type' => $validated['service_type'],
                            'description' => $validated['description'] ?? null,
                            'service_price' => $validated['service_price'],
                            'price' => $validated['service_price'],
                            'price_mode' => $validated['price_mode'],
                            'price_range_min' => $validated['price_mode'] === 'range' ? ($validated['price_range_min'] ?? 0) : null,
                            'price_range_max' => $validated['price_mode'] === 'range' ? ($validated['price_range_max'] ?? 0) : null,
                            'is_package_eligible' => $validated['is_package_eligible'],
                            'allow_photo_upload' => $validated['allow_photo_upload'],
                            'duration_min' => $validated['duration_min'],
                            'deposit_amount' => $validated['deposit_amount'],
                            'buffer_min' => $validated['buffer_min'] ?? 0,
                            'is_active' => $validated['is_active'],
                        ]);
                        $summary['created']++;
                    } else {
                        $incomingAllowed = collect($validated['allowed_staff_ids'])->map(fn ($id) => (int) $id)->sort()->values()->all();
                        $currentAllowed = $service->allowedStaffs()->pluck('staffs.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                        $incomingSlots = collect($validated['primary_slots'] ?? [])->map(fn ($time) => substr((string) $time, 0, 5))->sort()->values()->all();
                        $currentSlots = $service->primarySlots()->pluck('start_time')->map(fn ($time) => substr((string) $time, 0, 5))->sort()->values()->all();
                        $incomingQuestions = collect($validated['questions'] ?? [])
                            ->map(function ($question) {
                                $options = collect($question['options'] ?? [])
                                    ->map(fn ($option) => [
                                        'label' => trim((string) ($option['label'] ?? '')),
                                        'cn_label' => trim((string) ($option['cn_label'] ?? '')),
                                        'linked_booking_service_id' => (int) ($option['linked_booking_service_id'] ?? 0),
                                        'extra_duration_min' => max(0, (int) ($option['extra_duration_min'] ?? 0)),
                                        'extra_price' => max(0, (float) ($option['extra_price'] ?? 0)),
                                        'is_active' => (bool) ($option['is_active'] ?? true),
                                    ])
                                    ->values()
                                    ->all();

                                return [
                                    'title' => trim((string) ($question['title'] ?? '')),
                                    'cn_title' => trim((string) ($question['cn_title'] ?? '')),
                                    'description' => $question['description'] ?? null,
                                    'cn_description' => $question['cn_description'] ?? null,
                                    'question_type' => (string) ($question['question_type'] ?? 'single_choice'),
                                    'is_required' => (bool) ($question['is_required'] ?? false),
                                    'is_active' => (bool) ($question['is_active'] ?? true),
                                    'options' => $options,
                                ];
                            })
                            ->values()
                            ->all();
                        $currentQuestions = $service->questions()
                            ->with('options')
                            ->orderBy('sort_order')
                            ->get()
                            ->map(function (BookingServiceQuestion $question) {
                                return [
                                    'title' => trim((string) $question->title),
                                    'cn_title' => trim((string) ($question->cn_title ?? '')),
                                    'description' => $question->description,
                                    'cn_description' => $question->cn_description,
                                    'question_type' => (string) $question->question_type,
                                    'is_required' => (bool) $question->is_required,
                                    'is_active' => (bool) $question->is_active,
                                    'options' => $question->options
                                        ->sortBy('sort_order')
                                        ->values()
                                        ->map(fn (BookingServiceQuestionOption $option) => [
                                            'label' => trim((string) ($option->label ?? '')),
                                            'cn_label' => trim((string) ($option->cn_label ?? '')),
                                            'linked_booking_service_id' => (int) ($option->linked_booking_service_id ?? 0),
                                            'extra_duration_min' => max(0, (int) ($option->extra_duration_min ?? 0)),
                                            'extra_price' => max(0, (float) ($option->extra_price ?? 0)),
                                            'is_active' => (bool) $option->is_active,
                                        ])
                                        ->all(),
                                ];
                            })
                            ->values()
                            ->all();
                        $isUnchanged =
                            ($service->name === $validated['name']) &&
                            ((string) ($service->cn_name ?? '') === (string) ($validated['cn_name'] ?? '')) &&
                            ($service->service_type === $validated['service_type']) &&
                            (($service->description ?? null) === ($validated['description'] ?? null)) &&
                            ((int) $service->duration_min === (int) $validated['duration_min']) &&
                            ((float) $service->service_price === (float) $validated['service_price']) &&
                            ((float) $service->deposit_amount === (float) $validated['deposit_amount']) &&
                            ((int) $service->buffer_min === (int) ($validated['buffer_min'] ?? 0)) &&
                            ((bool) $service->is_active === (bool) $validated['is_active']) &&
                            ((bool) $service->is_package_eligible === (bool) $validated['is_package_eligible']) &&
                            ((bool) $service->allow_photo_upload === (bool) $validated['allow_photo_upload']) &&
                            ($service->price_mode === $validated['price_mode']) &&
                            ((float) ($service->price_range_min ?? 0) === (float) ($validated['price_range_min'] ?? 0)) &&
                            ((float) ($service->price_range_max ?? 0) === (float) ($validated['price_range_max'] ?? 0)) &&
                            ($incomingAllowed === $currentAllowed) &&
                            ($incomingSlots === $currentSlots) &&
                            ($incomingQuestions === $currentQuestions);
                        if ($isUnchanged) {
                            $summary['skipped']++;
                            return;
                        }
                        $service->update([
                            'name' => $validated['name'],
                            'cn_name' => $validated['cn_name'] ?? null,
                            'service_type' => $validated['service_type'],
                            'description' => $validated['description'] ?? null,
                            'service_price' => $validated['service_price'],
                            'price' => $validated['service_price'],
                            'price_mode' => $validated['price_mode'],
                            'price_range_min' => $validated['price_mode'] === 'range' ? ($validated['price_range_min'] ?? 0) : null,
                            'price_range_max' => $validated['price_mode'] === 'range' ? ($validated['price_range_max'] ?? 0) : null,
                            'is_package_eligible' => $validated['is_package_eligible'],
                            'allow_photo_upload' => $validated['allow_photo_upload'],
                            'duration_min' => $validated['duration_min'],
                            'deposit_amount' => $validated['deposit_amount'],
                            'buffer_min' => $validated['buffer_min'] ?? 0,
                            'is_active' => $validated['is_active'],
                        ]);
                        $summary['updated']++;
                    }

                    $this->syncAllowedStaffs($service, $this->resolveAllowedStaffIds($validated['allowed_staff_ids']));
                    $this->syncPrimarySlots($service, $validated['primary_slots'] ?? []);
                    $this->syncQuestions($service, $validated['questions'] ?? []);
                });
            } catch (\Throwable $throwable) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $throwable->getMessage()];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }

    private function resolveAllowedStaffIds(array $staffIds): array
    {
        $ids = collect($staffIds)->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->unique()->values();

        if ($ids->isEmpty()) {
            abort(response()->json([
                'success' => false,
                'message' => 'At least one allowed staff is required.',
                'data' => [
                    'errors' => [
                        'allowed_staff_ids' => ['At least one allowed staff is required.'],
                    ],
                ],
            ], 422));
        }

        $validIds = Staff::query()
            ->whereIn('id', $ids->all())
            ->where('is_active', true)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($validIds->count() !== $ids->count()) {
            abort(response()->json([
                'success' => false,
                'message' => 'Allowed staffs must be active staffs.',
                'data' => [
                    'errors' => [
                        'allowed_staff_ids' => ['Allowed staffs must be active staffs.'],
                    ],
                ],
            ], 422));
        }

        return $validIds->all();
    }

    private function syncAllowedStaffs(BookingService $service, array $allowedStaffIds): void
    {
        BookingServiceStaff::query()
            ->where('service_id', $service->id)
            ->whereNotIn('staff_id', $allowedStaffIds)
            ->delete();

        foreach ($allowedStaffIds as $staffId) {
            BookingServiceStaff::query()->updateOrCreate(
                ['service_id' => $service->id, 'staff_id' => $staffId],
                ['is_active' => true]
            );
        }
    }

    private function syncPrimarySlots(BookingService $service, array $primarySlots): void
    {
        BookingServicePrimarySlot::query()->where('booking_service_id', $service->id)->delete();

        $normalized = collect($primarySlots)
            ->map(fn ($time) => substr((string) $time, 0, 5))
            ->filter(fn ($time) => preg_match('/^\d{2}:\d{2}$/', $time) === 1)
            ->unique()
            ->values();

        foreach ($normalized as $index => $time) {
            BookingServicePrimarySlot::query()->create([
                'booking_service_id' => $service->id,
                'start_time' => $time . ':00',
                'sort_order' => $index,
                'is_active' => true,
            ]);
        }
    }

    private function syncQuestions(BookingService $service, array $questions): void
    {
        BookingServiceQuestion::query()->where('booking_service_id', $service->id)->delete();
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
            $question = BookingServiceQuestion::query()->create([
                'booking_service_id' => $service->id,
                'title' => (string) ($questionPayload['title'] ?? ''),
                'cn_title' => trim((string) ($questionPayload['cn_title'] ?? '')) ?: null,
                'description' => $questionPayload['description'] ?? null,
                'cn_description' => trim((string) ($questionPayload['cn_description'] ?? '')) ?: null,
                'question_type' => (string) ($questionPayload['question_type'] ?? 'single_choice'),
                // Order is defined by the request array; ignore client-provided sort_order values.
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
                    'extra_duration_min' => $linkedService ? (int) $linkedService->duration_min : max(0, (int) ($optionPayload['extra_duration_min'] ?? 0)),
                    'extra_price' => $linkedService ? max(0, (float) $linkedService->service_price) : max(0, (float) ($optionPayload['extra_price'] ?? 0)),
                    'sort_order' => $optionIndex,
                    'is_active' => (bool) ($optionPayload['is_active'] ?? true),
                ]);
            }
        }
    }

    private function resolveCategoryIds(Request $request, array $data): array
    {
        if ($request->has('category_ids') || array_key_exists('category_ids', $data)) {
            return collect($data['category_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all();
        }

        if ($request->has('category_id') || array_key_exists('category_id', $data)) {
            $categoryId = isset($data['category_id']) ? (int) $data['category_id'] : 0;

            return $categoryId > 0 ? [$categoryId] : [];
        }

        return [];
    }

    private function syncCategories(BookingService $service, array $categoryIds): void
    {
        $service->categories()->sync(
            collect($categoryIds)
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->unique()
                ->values()
                ->all()
        );
    }

    private function formatService(BookingService $service): array
    {
        $allowedStaffs = $service->allowedStaffs
            ->sortBy('name')
            ->values()
            ->map(fn (Staff $staff) => [
                'id' => (int) $staff->id,
                'name' => $staff->name,
                'position' => $staff->position,
                'avatar_path' => $staff->avatar_path,
                'avatar_url' => $staff->avatar_url,
            ])
            ->all();

        $primarySlots = $service->primarySlots
            ->where('is_active', true)
            ->sortBy('sort_order')
            ->values()
            ->map(fn (BookingServicePrimarySlot $slot) => [
                'id' => (int) $slot->id,
                'start_time' => substr((string) $slot->start_time, 0, 5),
                'sort_order' => (int) $slot->sort_order,
                'is_active' => (bool) $slot->is_active,
            ])
            ->all();

        $categories = $service->relationLoaded('categories')
            ? $service->categories->sortBy('name')->values()
            : collect();

        $categoryPayload = $categories->map(fn (BookingServiceCategory $category) => [
            'id' => (int) $category->id,
            'name' => $category->name,
            'cn_name' => $category->cn_name,
        ])->all();

        $firstCategory = $categoryPayload[0] ?? null;

        return array_merge($service->toArray(), [
            'allowed_staffs' => $allowedStaffs,
            'allowed_staff_ids' => array_map(fn (array $staff) => (int) $staff['id'], $allowedStaffs),
            'allowed_staff_count' => count($allowedStaffs),
            'allowed_staff_names' => collect($allowedStaffs)->pluck('name')->filter()->values()->all(),
            'category_id' => $firstCategory ? (int) $firstCategory['id'] : null,
            'category' => $firstCategory,
            'categories' => $categoryPayload,
            'category_ids' => array_map(fn (array $category) => (int) $category['id'], $categoryPayload),
            'linked_booking_product' => $this->productLinkService->formatLinkedProduct($service->linkedBookingProduct),
            'linked_booking_product_id' => $service->linked_booking_product_id ? (int) $service->linked_booking_product_id : null,
            'questions' => $service->questions
                ->sortBy('sort_order')
                ->values()
                ->map(fn (BookingServiceQuestion $question) => [
                    'id' => (int) $question->id,
                    'title' => (string) $question->title,
                    'cn_title' => $question->cn_title,
                    'description' => $question->description,
                    'cn_description' => $question->cn_description,
                    'question_type' => (string) $question->question_type,
                    'sort_order' => (int) $question->sort_order,
                    'is_required' => (bool) $question->is_required,
                    'is_active' => (bool) $question->is_active,
                    'options' => $question->options->sortBy('sort_order')->values()->map(fn ($option) => $this->formatQuestionOption($option))->all(),
                ])->all(),
            'primary_slots' => $primarySlots,
        ]);
    }

    private function formatQuestionOption(BookingServiceQuestionOption $option): array
    {
        $linkedService = $option->linkedBookingService;
        $extraDuration = $linkedService ? (int) $linkedService->duration_min : (int) $option->extra_duration_min;
        $extraPrice = $linkedService ? (float) $linkedService->service_price : (float) $option->extra_price;

        return [
            'id' => (int) $option->id,
            'label' => trim((string) $option->label) !== '' ? (string) $option->label : (string) optional($linkedService)->name,
            'cn_label' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $linkedService?->cn_name,
            'linked_booking_service_id' => $option->linked_booking_service_id ? (int) $option->linked_booking_service_id : null,
            'extra_duration_min' => $extraDuration,
            'extra_price' => $extraPrice,
            'linked_price_mode' => $linkedService ? (string) ($linkedService->price_mode ?? 'fixed') : null,
            'linked_price_range_min' => $linkedService && $linkedService->price_range_min !== null ? (float) $linkedService->price_range_min : null,
            'linked_price_range_max' => $linkedService && $linkedService->price_range_max !== null ? (float) $linkedService->price_range_max : null,
            'sort_order' => (int) $option->sort_order,
            'is_active' => (bool) $option->is_active,
        ];
    }

    private function rollbackFailedServiceSave(?string $uploadedServiceImagePath): void
    {
        $this->productLinkService->cleanupCopiedImagePaths();

        if ($uploadedServiceImagePath && Storage::disk('public')->exists($uploadedServiceImagePath)) {
            Storage::disk('public')->delete($uploadedServiceImagePath);
        }
    }

    private function formatServiceSaveFailureMessage(\Throwable $exception, string $action): string
    {
        $prefix = $action === 'create'
            ? 'Failed to create booking service. No changes were saved.'
            : 'Failed to update booking service. No changes were saved.';

        if ($exception instanceof QueryException) {
            return $prefix;
        }

        $detail = trim($exception->getMessage());

        return $detail !== '' ? $prefix . ' ' . $detail : $prefix;
    }
}
