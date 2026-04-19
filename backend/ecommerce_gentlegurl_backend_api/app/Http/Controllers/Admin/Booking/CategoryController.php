<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = BookingServiceCategory::query()
            ->with('services:id,name')
            ->when($request->filled('name'), fn ($query) => $query->where('name', 'like', '%' . $request->string('name') . '%'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        $categories->getCollection()->transform(fn (BookingServiceCategory $category) => $this->formatCategory($category));

        return $this->respond($categories);
    }

    public function show(int $id)
    {
        $category = BookingServiceCategory::query()->with('services:id,name')->findOrFail($id);

        return $this->respond($this->formatCategory($category));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', 'exists:booking_services,id'],
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $data['sort_order'] = ((int) BookingServiceCategory::query()->max('sort_order')) + 1;
        $serviceIds = array_values(array_unique(array_map('intval', $data['service_ids'] ?? [])));
        unset($data['service_ids']);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/category-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $category = BookingServiceCategory::query()->create($data);
        $category->services()->sync(BookingService::query()->whereIn('id', $serviceIds)->pluck('id')->all());

        return $this->respond($this->formatCategory($category->fresh('services:id,name')), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug,' . $category->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', 'exists:booking_services,id'],
        ]);

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

        $serviceIds = null;
        if (array_key_exists('service_ids', $data)) {
            $serviceIds = array_values(array_unique(array_map('intval', $data['service_ids'] ?? [])));
            unset($data['service_ids']);
        }

        $category->update($data);

        if ($serviceIds !== null) {
            $category->services()->sync(BookingService::query()->whereIn('id', $serviceIds)->pluck('id')->all());
        }

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
    }

    public function destroy(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
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

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
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

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
    }

    public function exportCsv(Request $request)
    {
        $categories = BookingServiceCategory::query()
            ->with('services:id,name')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking categories CSV export.'], 500);
        }

        $headers = ['id', 'name', 'slug', 'description', 'is_active', 'sort_order', 'service_ids'];
        fputcsv($stream, $headers);

        foreach ($categories as $category) {
            fputcsv($stream, [
                $category->id,
                $category->name,
                $category->slug,
                $category->description,
                $category->is_active ? 'true' : 'false',
                $category->sort_order,
                $category->services->pluck('id')->join('|'),
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
        $allowedHeaders = ['id', 'name', 'slug', 'description', 'is_active', 'sort_order', 'service_ids'];
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

            $serviceIds = [];
            if (isset($payload['service_ids']) && $payload['service_ids'] !== '') {
                $serviceIds = collect(explode('|', $payload['service_ids']))
                    ->map(fn ($id) => (int) trim($id))
                    ->filter(fn ($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();
            }

            $raw = [
                'name' => $payload['name'] ?? null,
                'slug' => $payload['slug'] ?? null,
                'description' => $payload['description'] ?? null,
                'sort_order' => $payload['sort_order'] ?? null,
                'is_active' => $payload['is_active'] ?? null,
                'service_ids' => $serviceIds,
            ];

            if ($raw['is_active'] !== null && $raw['is_active'] !== '') {
                $raw['is_active'] = filter_var($raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } else {
                $raw['is_active'] = true;
            }

            if ($raw['sort_order'] === '') {
                $raw['sort_order'] = null;
            }

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:150'],
                'slug' => ['nullable', 'string', 'max:150'],
                'description' => ['nullable', 'string'],
                'is_active' => ['required', 'boolean'],
                'sort_order' => ['nullable', 'integer', 'min:0'],
                'service_ids' => ['nullable', 'array'],
                'service_ids.*' => ['integer', 'exists:booking_services,id'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            $category = $id
                ? BookingServiceCategory::query()->find($id)
                : BookingServiceCategory::query()->where('slug', $validated['slug'] ?: Str::slug((string) $validated['name']))->first();

            $validated['slug'] = $validated['slug'] ?: Str::slug((string) $validated['name']);

            if (! $category) {
                if ($validated['sort_order'] === null) {
                    $validated['sort_order'] = ((int) BookingServiceCategory::query()->max('sort_order')) + 1;
                }
                $category = BookingServiceCategory::query()->create(collect($validated)->except('service_ids')->all());
                $summary['created']++;
            } else {
                $incoming = collect($validated)->except('service_ids')->all();
                $currentServices = $category->services()->pluck('booking_services.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                $nextServices = collect($validated['service_ids'] ?? [])->map(fn ($id) => (int) $id)->sort()->values()->all();
                $isUnchanged =
                    ($category->name === ($incoming['name'] ?? $category->name)) &&
                    ($category->slug === ($incoming['slug'] ?? $category->slug)) &&
                    (($category->description ?? null) === ($incoming['description'] ?? null)) &&
                    ((bool) $category->is_active === (bool) ($incoming['is_active'] ?? $category->is_active)) &&
                    ((int) $category->sort_order === (int) ($incoming['sort_order'] ?? $category->sort_order)) &&
                    ($currentServices === $nextServices);
                if ($isUnchanged) {
                    $summary['skipped']++;
                    continue;
                }
                if ($validated['sort_order'] === null) {
                    unset($validated['sort_order']);
                }
                $category->update(collect($validated)->except('service_ids')->all());
                $summary['updated']++;
            }

            $category->services()->sync($validated['service_ids'] ?? []);
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }

    private function formatCategory(BookingServiceCategory $category): array
    {
        $services = $category->services
            ->sortBy('name')
            ->values()
            ->map(fn (BookingService $service) => [
                'id' => (int) $service->id,
                'name' => $service->name,
            ])->all();

        return [
            'id' => (int) $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image_path' => $category->image_path,
            'image_url' => $category->image_url,
            'is_active' => (bool) $category->is_active,
            'sort_order' => (int) $category->sort_order,
            'services' => $services,
            'service_ids' => array_map(fn (array $item) => (int) $item['id'], $services),
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
        ];
    }
}
