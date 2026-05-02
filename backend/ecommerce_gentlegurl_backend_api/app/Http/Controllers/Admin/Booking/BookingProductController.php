<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingProduct;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class BookingProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min(200, $request->integer('per_page', 20)));

        $query = BookingProduct::query()
            ->with('categories')
                        ->orderByRaw("COALESCE(booking_products.name, '') asc")
            ->orderBy('booking_products.id');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $keyword = mb_strtolower($search);
            $query->where(function ($q) use ($keyword) {
                $q->whereRaw('LOWER(COALESCE(name, \'\')) like ?', ["%{$keyword}%"])
                  ->orWhereRaw('LOWER(COALESCE(barcode, \'\')) like ?', ["%{$keyword}%"])
                  ->orWhereHas('categories', fn($cq) => $cq->whereRaw('LOWER(COALESCE(name, \'\')) like ?', ["%{$keyword}%"]));
            });
        }

        if ($request->filled('is_active')) {
            $query->where('booking_products.is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOL));
        }

        if ($request->filled('category_id')) {
            $query->whereHas('categories', fn($q) => $q->where('booking_product_categories.id', (int) $request->input('category_id')));
        }

        return $this->respond($query->select('booking_products.*')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/product-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $categoryIds = $data['category_ids'] ?? [];
        unset($data['category_ids']);

        $product = BookingProduct::create($data);
        $product->categories()->sync($categoryIds);

        return $this->respond($product->load('categories'), 'Created', true, 201);
    }

    public function show(int $id)
    {
        return $this->respond(BookingProduct::query()->with('categories')->findOrFail($id));
    }

    public function update(Request $request, int $id)
    {
        $product = BookingProduct::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $oldImagePath = $product->image_path;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/product-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $categoryIds = $data['category_ids'] ?? null;
        unset($data['category_ids']);

        $product->update($data);

        if ($categoryIds !== null) {
            $product->categories()->sync($categoryIds);
        }

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($product->fresh()->load('categories'));
    }

    public function destroy(int $id)
    {
        $product = BookingProduct::findOrFail($id);
        $product->delete();

        return $this->respond(null);
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_products,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $products = BookingProduct::query()->whereIn('id', $validated['ids'])->get();
        $payload = collect($validated)->except('ids')->toArray();

        foreach ($products as $product) {
            $categoryIds = $payload['category_ids'] ?? null;
            $fillPayload = collect($payload)->except('category_ids')->toArray();
            if (! empty($fillPayload)) {
                $product->fill($fillPayload);
                $product->save();
            }
            if ($categoryIds !== null) {
                $product->categories()->sync($categoryIds);
            }
        }

        return $this->respond($products->load('categories'), __('Booking products updated successfully.'));
    }

    public function exportCsv(Request $request)
    {
        $rows = BookingProduct::query()
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking products CSV export.'], 500);
        }

        $headers = ['id', 'name', 'price', 'barcode', 'description', 'category_id', 'is_active'];
        fputcsv($stream, $headers);

        foreach ($rows as $p) {
            fputcsv($stream, [
                $p->id,
                $p->name,
                $p->price,
                $p->barcode,
                $p->description,
                $p->category_id,
                $p->is_active ? 'true' : 'false',
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        $filename = 'booking_products_export_' . now()->format('Y-m-d_H-i-s') . '.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file'],
        ]);

        $file = $request->file('file');
        if (! $file) {
            return response()->json(['message' => 'CSV file is required.'], 422);
        }

        $handle = fopen($file->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to read CSV file.'], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers) || count($headers) === 0) {
            fclose($handle);
            return response()->json(['message' => 'CSV header row is missing.'], 422);
        }

        $headers = array_map(fn ($h) => strtolower(trim((string) $h)), $headers);
        $allowed = ['id', 'name', 'price', 'barcode', 'description', 'category_id', 'is_active'];
        $unknown = array_values(array_diff(array_filter($headers), $allowed));
        if (! empty($unknown)) {
            fclose($handle);
            return response()->json(['message' => 'Unknown headers: ' . implode(', ', $unknown)], 422);
        }

        $summary = [
            'totalRows' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'failedRows' => [],
        ];

        $rowNumber = 1;
        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($row) || count(array_filter($row, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $summary['totalRows']++;
            $payload = [];
            foreach ($headers as $idx => $key) {
                $payload[$key] = $row[$idx] ?? null;
            }

            try {
                $data = [
                    'id' => isset($payload['id']) && trim((string) $payload['id']) !== '' ? (int) $payload['id'] : null,
                    'name' => trim((string) ($payload['name'] ?? '')),
                    'price' => $payload['price'],
                    'barcode' => isset($payload['barcode']) ? trim((string) $payload['barcode']) : null,
                    'description' => isset($payload['description']) ? trim((string) $payload['description']) : null,
                    'category_id' => isset($payload['category_id']) && trim((string) $payload['category_id']) !== '' ? (int) $payload['category_id'] : null,
                    'is_active' => isset($payload['is_active']) ? filter_var($payload['is_active'], FILTER_VALIDATE_BOOLEAN) : null,
                ];

                $validator = Validator::make($data, [
                    'name' => ['required', 'string', 'max:255'],
                    'price' => ['required', 'numeric', 'min:0'],
                    'barcode' => ['nullable', 'string', 'max:255'],
                    'description' => ['nullable', 'string'],
                    'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
                    'is_active' => ['nullable', 'boolean'],
                ]);

                if ($validator->fails()) {
                    $summary['failed']++;
                    $summary['failedRows'][] = [
                        'row' => $rowNumber,
                        'reason' => implode(' ', $validator->errors()->all()),
                    ];
                    continue;
                }

                $valid = $validator->validated();
                $categoryId = $data['category_id'];
                unset($valid['category_id']);

                if ($data['id']) {
                    $product = BookingProduct::query()->find($data['id']);
                    if ($product) {
                        $product->fill($valid);
                        if ($data['is_active'] !== null) {
                            $product->is_active = (bool) $data['is_active'];
                        }
                        $product->save();
                        $product->categories()->sync($categoryId ? [$categoryId] : []);
                        $summary['updated']++;
                        continue;
                    }
                }

                $create = $valid;
                if ($data['is_active'] !== null) {
                    $create['is_active'] = (bool) $data['is_active'];
                }
                $product = BookingProduct::create($create);
                $product->categories()->sync($categoryId ? [$categoryId] : []);
                $summary['created']++;
            } catch (\Throwable $e) {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => $e->getMessage(),
                ];
            }
        }

        fclose($handle);

        return $this->respond($summary, __('Booking products import completed.'));
    }
}
