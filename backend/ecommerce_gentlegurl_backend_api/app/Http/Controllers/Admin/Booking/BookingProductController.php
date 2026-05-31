<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingProduct;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class BookingProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min(200, $request->integer('per_page', 20)));

        $query = BookingProduct::query()
            ->with(['categories', 'questions.options'])
            ->orderByRaw("COALESCE(booking_products.name, '') asc")
            ->orderBy('booking_products.id');

        if ($request->filled('search')) {
            $keyword = mb_strtolower(trim((string) $request->input('search')));
            $query->where(function ($q) use ($keyword) {
                $q->whereRaw('LOWER(COALESCE(name, \'\')) like ?', ["%{$keyword}%"])
                    ->orWhereRaw('LOWER(COALESCE(barcode, \'\')) like ?', ["%{$keyword}%"])
                    ->orWhereHas('categories', fn ($cq) => $cq->whereRaw('LOWER(COALESCE(name, \'\')) like ?', ["%{$keyword}%"]));
            });
        }

        if ($request->filled('is_active')) {
            $query->where('booking_products.is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOL));
        }

        if ($request->filled('category_id')) {
            $query->whereHas('categories', fn ($q) => $q->where('booking_product_categories.id', (int) $request->input('category_id')));
        }

        return $this->respond($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'cn_name' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_product_categories,id'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'questions' => ['nullable', 'array'],
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

        $questions = $request->input('questions', []);
        $product = BookingProduct::create($data);
        $product->categories()->sync($categoryIds);
        $this->syncQuestions($product, is_array($questions) ? $questions : []);

        return $this->respond($product->load(['categories', 'questions.options']), 'Created', true, 201);
    }

    public function show(int $id)
    {
        return $this->respond(BookingProduct::query()->with(['categories', 'questions.options'])->findOrFail($id));
    }

    public function update(Request $request, int $id)
    {
        $product = BookingProduct::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'cn_name' => ['nullable', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_product_categories,id'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'questions' => ['nullable', 'array'],
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
        if ($request->has('questions')) {
            $this->syncQuestions($product, is_array($request->input('questions')) ? $request->input('questions') : []);
        }

        if ($categoryIds !== null) {
            $product->categories()->sync($categoryIds);
        }

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($product->fresh()->load(['categories', 'questions.options']));
    }



    private function syncQuestions(BookingProduct $product, array $questions): void
    {
        $existingIds = $product->questions()->pluck('id')->all();
        $keepQuestionIds = [];

        foreach ($questions as $question) {
            if (! is_array($question) || trim((string) ($question['title'] ?? '')) === '') {
                continue;
            }

            $questionModel = $product->questions()->updateOrCreate(
                ['id' => (int) ($question['id'] ?? 0)],
                [
                    'title' => trim((string) ($question['title'] ?? '')),
                    'cn_title' => trim((string) ($question['cn_title'] ?? '')) ?: null,
                    'description' => trim((string) ($question['description'] ?? '')) ?: null,
                    'cn_description' => trim((string) ($question['cn_description'] ?? '')) ?: null,
                    'question_type' => in_array(($question['question_type'] ?? 'single_choice'), ['single_choice', 'multi_choice'], true) ? $question['question_type'] : 'single_choice',
                    'sort_order' => (int) ($question['sort_order'] ?? 0),
                    'is_required' => (bool) ($question['is_required'] ?? false),
                    'is_active' => (bool) ($question['is_active'] ?? true),
                ]
            );

            $keepQuestionIds[] = $questionModel->id;
            $existingOptionIds = $questionModel->options()->pluck('id')->all();
            $keepOptionIds = [];

            foreach (($question['options'] ?? []) as $option) {
                if (! is_array($option) || trim((string) ($option['label'] ?? '')) === '') {
                    continue;
                }
                $optionModel = $questionModel->options()->updateOrCreate(
                    ['id' => (int) ($option['id'] ?? 0)],
                    [
                        'label' => trim((string) ($option['label'] ?? '')),
                        'cn_label' => trim((string) ($option['cn_label'] ?? '')) ?: null,
                        'extra_price' => max(0, (float) ($option['extra_price'] ?? 0)),
                        'sort_order' => (int) ($option['sort_order'] ?? 0),
                        'is_active' => (bool) ($option['is_active'] ?? true),
                    ]
                );
                $keepOptionIds[] = $optionModel->id;
            }

            $deleteOptionIds = array_diff($existingOptionIds, $keepOptionIds);
            if (! empty($deleteOptionIds)) {
                $questionModel->options()->whereIn('id', $deleteOptionIds)->delete();
            }
        }

        $deleteQuestionIds = array_diff($existingIds, $keepQuestionIds);
        if (! empty($deleteQuestionIds)) {
            $product->questions()->whereIn('id', $deleteQuestionIds)->delete();
        }
    }

    public function destroy(int $id)
    {
        BookingProduct::findOrFail($id)->delete();

        return $this->respond(null);
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_products,id'],
        ]);

        $deletedCount = BookingProduct::query()->whereIn('id', $validated['ids'])->delete();

        return $this->respond([
            'deleted_count' => $deletedCount,
        ], __('Booking products deleted successfully.'));
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:booking_products,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:booking_product_categories,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $products = BookingProduct::query()->whereIn('id', $validated['ids'])->get();
        $payload = collect($validated)->except('ids')->toArray();

        foreach ($products as $product) {
            $categoryIds = $payload['category_ids'] ?? null;
            $fillPayload = collect($payload)->except('category_ids')->toArray();
            if (! empty($fillPayload)) {
                $product->fill($fillPayload)->save();
            }
            if ($categoryIds !== null) {
                $product->categories()->sync($categoryIds);
            }
        }

        return $this->respond($products->load('categories'), __('Booking products updated successfully.'));
    }

    public function exportCsv(Request $request)
    {
        $rows = BookingProduct::query()->with(['categories', 'questions.options'])->orderBy('id')->get();
        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking products CSV export.'], 500);
        }

        fputcsv($stream, ['id', 'name', 'price', 'barcode', 'description', 'category_ids', 'is_active']);

        foreach ($rows as $p) {
            fputcsv($stream, [
                $p->id,
                $p->name,
                $p->price,
                $p->barcode,
                $p->description,
                $p->categories->pluck('id')->implode('|'),
                $p->is_active ? 'true' : 'false',
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="booking_products_export_' . now()->format('Y-m-d_H-i-s') . '.csv"',
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
        $allowed = ['id', 'name', 'price', 'barcode', 'description', 'category_ids', 'is_active'];
        $unknown = array_values(array_diff(array_filter($headers), $allowed));
        if (! empty($unknown)) {
            fclose($handle);
            return response()->json(['message' => 'Unknown headers: ' . implode(', ', $unknown)], 422);
        }

        while (($row = fgetcsv($handle)) !== false) {
            $payload = [];
            foreach ($headers as $idx => $key) {
                $payload[$key] = $row[$idx] ?? null;
            }

            $categoryIds = collect(explode('|', (string) ($payload['category_ids'] ?? '')))
                ->map(fn ($v) => (int) trim($v))
                ->filter(fn ($v) => $v > 0)
                ->values()
                ->all();

            $data = [
                'name' => trim((string) ($payload['name'] ?? '')),
                'price' => $payload['price'],
                'barcode' => isset($payload['barcode']) ? trim((string) $payload['barcode']) : null,
                'description' => isset($payload['description']) ? trim((string) $payload['description']) : null,
                'is_active' => isset($payload['is_active']) ? filter_var($payload['is_active'], FILTER_VALIDATE_BOOLEAN) : true,
                'category_ids' => $categoryIds,
            ];

            $validator = Validator::make($data, [
                'name' => ['required', 'string', 'max:255'],
                'cn_name' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
                'barcode' => ['nullable', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'is_active' => ['nullable', 'boolean'],
                'category_ids' => ['nullable', 'array'],
                'category_ids.*' => ['integer', 'exists:booking_product_categories,id'],
            ]);

            if ($validator->fails()) {
                continue;
            }

            $valid = $validator->validated();
            $syncIds = $valid['category_ids'] ?? [];
            unset($valid['category_ids']);

            $product = BookingProduct::query()->updateOrCreate(
                ['name' => $valid['name']],
                $valid
            );
            $product->categories()->sync($syncIds);
        }

        fclose($handle);

        return $this->respond(['ok' => true], __('Booking products import completed.'));
    }
}
