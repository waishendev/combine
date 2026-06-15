<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingProductCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BookingProductCategoryController extends Controller
{
    /**
     * Paginate when page/per_page are sent; all=1 returns full list; legacy (no params) returns all rows.
     */
    public function index(Request $request)
    {
        $query = BookingProductCategory::query()
            ->select(['id', 'name', 'cn_name', 'sort_order', 'is_active'])
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($request->boolean('all')) {
            return $this->respond($query->get());
        }

        if ($request->filled('page') || $request->filled('per_page')) {
            return $this->respond($query->paginate($request->integer('per_page', 50)));
        }

        return $this->respond($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'cn_name' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (! isset($data['sort_order']) || $data['sort_order'] === null) {
            $data['sort_order'] = ((int) BookingProductCategory::query()->max('sort_order')) + 1;
        }

        return $this->respond(BookingProductCategory::query()->create($data), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $category = BookingProductCategory::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'cn_name' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $category->update($data);

        return $this->respond($category->fresh());
    }

    public function destroy(int $id)
    {
        $category = BookingProductCategory::query()->findOrFail($id);
        $category->delete();

        return $this->respond(null);
    }

    public function exportCsv()
    {
        $categories = BookingProductCategory::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking product categories CSV export.'], 500);
        }

        $headers = ['id', 'name', 'cn_name', 'sort_order', 'is_active'];
        fputcsv($stream, $headers);

        foreach ($categories as $category) {
            fputcsv($stream, [
                $category->id,
                $category->name,
                $category->cn_name,
                $category->sort_order,
                $category->is_active ? 'true' : 'false',
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-product-categories-export_' . now()->format('Y-m-d_His') . '.csv"',
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
        $allowedHeaders = ['id', 'name', 'cn_name', 'sort_order', 'is_active'];
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
                'sort_order' => $payload['sort_order'] ?? null,
                'is_active' => $payload['is_active'] ?? null,
            ];

            if ($raw['is_active'] !== null && $raw['is_active'] !== '') {
                $raw['is_active'] = filter_var($raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            } else {
                $raw['is_active'] = true;
            }

            if ($raw['sort_order'] === '' || $raw['sort_order'] === null) {
                $raw['sort_order'] = null;
            } elseif (is_numeric($raw['sort_order'])) {
                $raw['sort_order'] = (int) $raw['sort_order'];
            }

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:255'],
                'cn_name' => ['nullable', 'string', 'max:255'],
                'is_active' => ['required', 'boolean'],
                'sort_order' => ['nullable', 'integer', 'min:0'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];

                continue;
            }

            $validated = $validator->validated();
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            $category = $id ? BookingProductCategory::query()->find($id) : null;

            if ($id && ! $category) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => 'Category id not found: ' . $id];

                continue;
            }

            if (! $category && ! $id) {
                $category = BookingProductCategory::query()->where('name', $validated['name'])->first();
            }

            if (! $category) {
                if ($validated['sort_order'] === null) {
                    $validated['sort_order'] = ((int) BookingProductCategory::query()->max('sort_order')) + 1;
                }
                BookingProductCategory::query()->create($validated);
                $summary['created']++;
            } else {
                $incoming = $validated;
                $isUnchanged =
                    ($category->name === $incoming['name']) &&
                    (($category->cn_name ?? null) === ($incoming['cn_name'] ?? null)) &&
                    ((int) $category->sort_order === (int) ($incoming['sort_order'] ?? $category->sort_order)) &&
                    ((bool) $category->is_active === (bool) $incoming['is_active']);
                if ($isUnchanged) {
                    $summary['skipped']++;

                    continue;
                }
                if (! array_key_exists('sort_order', $incoming) || $incoming['sort_order'] === null) {
                    unset($incoming['sort_order']);
                }
                $category->update($incoming);
                $summary['updated']++;
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }
}
