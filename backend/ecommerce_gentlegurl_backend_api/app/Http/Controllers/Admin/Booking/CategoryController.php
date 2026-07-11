<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingServiceCategory;
use App\Services\Booking\BookingServiceCategoryProductLinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function __construct(
        private readonly BookingServiceCategoryProductLinkService $productCategoryLinkService,
    ) {
    }

    public function index(Request $request)
    {
        $query = BookingServiceCategory::query()
            ->when($request->filled('name'), fn ($inner) => $inner->where('name', 'like', '%' . $request->string('name') . '%'))
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->boolean('all')) {
            return $this->respond(
                $query->get()->map(fn (BookingServiceCategory $category) => $this->formatCategory($category))->values()
            );
        }

        $categories = $query->paginate($request->integer('per_page', 20));

        $categories->getCollection()->transform(fn (BookingServiceCategory $category) => $this->formatCategory($category));

        return $this->respond($categories);
    }

    public function show(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);

        return $this->respond($this->formatCategory($category));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'cn_name' => ['nullable', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'show_in_pos_filter' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if (array_key_exists('cn_name', $data)) {
            $cnName = trim((string) ($data['cn_name'] ?? ''));
            $data['cn_name'] = $cnName !== '' ? $cnName : null;
        }

        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $data['sort_order'] = ((int) BookingServiceCategory::query()->max('sort_order')) + 1;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/category-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $category = BookingServiceCategory::query()->create($data);

        if ($request->boolean('create_linked_product_category')) {
            $this->productCategoryLinkService->linkAfterCreate($category);
        }

        return $this->respond($this->formatCategory($category->fresh()), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'cn_name' => ['nullable', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug,' . $category->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'show_in_pos_filter' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if (array_key_exists('cn_name', $data)) {
            $cnName = trim((string) ($data['cn_name'] ?? ''));
            $data['cn_name'] = $cnName !== '' ? $cnName : null;
        }

        $oldImagePath = $category->image_path;
        if (! isset($data['slug']) && isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/category-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $category->update($data);

        $unlinkProductCategory = $request->boolean('unlink_product_category');
        $overwriteLinkedProductCategory = $request->boolean('overwrite_linked_product_category');
        $hasLinkedProductCategoryInput = $request->has('linked_booking_product_category_id');
        $linkedProductCategoryId = $hasLinkedProductCategoryInput
            ? (($request->input('linked_booking_product_category_id') ?? null) !== null
                ? (int) $request->input('linked_booking_product_category_id')
                : null)
            : null;

        if ($unlinkProductCategory || $overwriteLinkedProductCategory || $hasLinkedProductCategoryInput) {
            $this->productCategoryLinkService->handleUpdateLink(
                $category,
                $unlinkProductCategory,
                $overwriteLinkedProductCategory,
                $linkedProductCategoryId,
                $hasLinkedProductCategoryInput,
            );
        }

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($this->formatCategory($category->fresh()));
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_service_categories,id'],
            'name' => ['nullable', 'string', 'max:150'],
            'cn_name' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'show_in_pos_filter' => ['nullable', 'boolean'],
        ]);

        $categories = BookingServiceCategory::query()->whereIn('id', $validated['ids'])->get();
        $payload = collect($validated)->except('ids')->toArray();
        if (array_key_exists('cn_name', $payload)) {
            $cnName = trim((string) ($payload['cn_name'] ?? ''));
            $payload['cn_name'] = $cnName !== '' ? $cnName : null;
        }

        foreach ($categories as $category) {
            if (! empty($payload)) {
                $category->update($payload);
                $this->productCategoryLinkService->syncLinkedProductCategory($category->fresh());
            }
        }

        $fresh = BookingServiceCategory::query()
            ->whereIn('id', $validated['ids'])
            ->get()
            ->map(fn (BookingServiceCategory $category) => $this->formatCategory($category));

        return $this->respond($fresh, __('Booking categories updated successfully.'));
    }

    public function destroy(Request $request, int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);

        if ($request->boolean('delete_linked_product_category')) {
            $this->productCategoryLinkService->deleteLinkedProductCategory($category);
        }

        $category->delete();

        return $this->respond(null);
    }

    public function moveUp(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $swap = BookingServiceCategory::query()
            ->where('sort_order', '<', $category->sort_order)
            ->orderByDesc('sort_order')
            ->first();

        if ($swap) {
            $original = $category->sort_order;
            $category->update(['sort_order' => $swap->sort_order]);
            $swap->update(['sort_order' => $original]);
        }

        return $this->respond($this->formatCategory($category->fresh()));
    }

    public function moveDown(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $swap = BookingServiceCategory::query()
            ->where('sort_order', '>', $category->sort_order)
            ->orderBy('sort_order')
            ->first();

        if ($swap) {
            $original = $category->sort_order;
            $category->update(['sort_order' => $swap->sort_order]);
            $swap->update(['sort_order' => $original]);
        }

        return $this->respond($this->formatCategory($category->fresh()));
    }

    public function exportCsv(Request $request)
    {
        $categories = BookingServiceCategory::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking categories CSV export.'], 500);
        }

        $headers = ['id', 'name', 'cn_name', 'slug', 'description', 'is_active', 'show_in_pos_filter', 'sort_order'];
        fputcsv($stream, $headers);

        foreach ($categories as $category) {
            fputcsv($stream, [
                $category->id,
                $category->name,
                $category->cn_name,
                $category->slug,
                $category->description,
                $category->is_active ? 'true' : 'false',
                ($category->show_in_pos_filter ?? true) ? 'true' : 'false',
                $category->sort_order,
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-categories-export_' . now()->format('Y-m-d_His') . '.csv"',
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
        $allowedHeaders = ['id', 'name', 'cn_name', 'slug', 'description', 'is_active', 'show_in_pos_filter', 'sort_order'];
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


            $raw = [
                'name' => $payload['name'] ?? null,
                'cn_name' => $payload['cn_name'] ?? null,
                'slug' => $payload['slug'] ?? null,
                'description' => $payload['description'] ?? null,
                'sort_order' => $payload['sort_order'] ?? null,
                'is_active' => $payload['is_active'] ?? null,
                'show_in_pos_filter' => $payload['show_in_pos_filter'] ?? null,
            ];

            if ($raw['is_active'] !== null && $raw['is_active'] !== '') {
                $raw['is_active'] = filter_var($raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } else {
                $raw['is_active'] = true;
            }

            if ($raw['show_in_pos_filter'] !== null && $raw['show_in_pos_filter'] !== '') {
                $raw['show_in_pos_filter'] = filter_var($raw['show_in_pos_filter'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } else {
                $raw['show_in_pos_filter'] = true;
            }

            if ($raw['sort_order'] === '') {
                $raw['sort_order'] = null;
            }

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:150'],
                'cn_name' => ['nullable', 'string', 'max:150'],
                'slug' => ['nullable', 'string', 'max:150'],
                'description' => ['nullable', 'string'],
                'is_active' => ['required', 'boolean'],
                'show_in_pos_filter' => ['required', 'boolean'],
                'sort_order' => ['nullable', 'integer', 'min:0'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $validated['cn_name'] = trim((string) ($validated['cn_name'] ?? '')) !== ''
                ? trim((string) $validated['cn_name'])
                : null;
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            $category = $id
                ? BookingServiceCategory::query()->find($id)
                : BookingServiceCategory::query()->where('slug', $validated['slug'] ?: Str::slug((string) $validated['name']))->first();

            $validated['slug'] = $validated['slug'] ?: Str::slug((string) $validated['name']);

            if (! $category) {
                if ($validated['sort_order'] === null) {
                    $validated['sort_order'] = ((int) BookingServiceCategory::query()->max('sort_order')) + 1;
                }
                $category = BookingServiceCategory::query()->create($validated);
                $this->productCategoryLinkService->linkAfterCreate($category);
                $summary['created']++;
            } else {
                $incoming = $validated;
                $isUnchanged =
                    ($category->name === ($incoming['name'] ?? $category->name)) &&
                    ((string) ($category->cn_name ?? '') === (string) ($incoming['cn_name'] ?? $category->cn_name ?? '')) &&
                    ($category->slug === ($incoming['slug'] ?? $category->slug)) &&
                    (($category->description ?? null) === ($incoming['description'] ?? null)) &&
                    ((bool) $category->is_active === (bool) ($incoming['is_active'] ?? $category->is_active)) &&
                    ((bool) ($category->show_in_pos_filter ?? true) === (bool) ($incoming['show_in_pos_filter'] ?? true)) &&
                    ((int) $category->sort_order === (int) ($incoming['sort_order'] ?? $category->sort_order));
                if ($isUnchanged) {
                    $summary['skipped']++;
                    continue;
                }
                if ($validated['sort_order'] === null) {
                    unset($validated['sort_order']);
                }
                $category->update($validated);
                $this->productCategoryLinkService->syncLinkedProductCategory($category->fresh());
                $summary['updated']++;
            }

        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }

    private function formatCategory(BookingServiceCategory $category): array
    {
        $linkedProductCategory = null;
        if ($category->linked_booking_product_category_id) {
            $linked = $this->productCategoryLinkService->resolveLinkedProductCategory($category);
            if ($linked) {
                $linkedProductCategory = [
                    'id' => (int) $linked->id,
                    'name' => $linked->name,
                    'cn_name' => $linked->cn_name,
                    'is_active' => (bool) $linked->is_active,
                ];
            }
        }

        return [
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
            'linked_booking_product_category_id' => $category->linked_booking_product_category_id
                ? (int) $category->linked_booking_product_category_id
                : null,
            'linked_booking_product_category' => $linkedProductCategory,
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
        ];
    }
}
