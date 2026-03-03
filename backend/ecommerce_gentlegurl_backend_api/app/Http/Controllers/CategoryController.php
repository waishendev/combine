<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\ShopMenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $categories = Category::with(['parent', 'shopMenus'])
            ->when($request->filled('name'), function ($query) use ($request) {
                $query->where('name', 'like', '%' . $request->get('name') . '%');
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->orderBy('sort_order')
            ->paginate($perPage);

        $categories->getCollection()->transform(fn ($category) => $this->formatCategory($category));

        return $this->respond($categories);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['required', 'string', 'max:150', 'unique:categories,slug'],
            'description' => ['nullable', 'string'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'menu_ids' => ['array', 'nullable'],
            'menu_ids.*' => ['integer', 'exists:shop_menu_items,id'],
        ]);

        $menuIds = $validated['menu_ids'] ?? [];
        unset($validated['menu_ids']);

        $category = Category::create($validated + ['is_active' => $validated['is_active'] ?? true]);
        $category->shopMenus()->sync($menuIds);

        return $this->respond(
            $this->formatCategory($category->fresh(['shopMenus'])),
            __('Category created successfully.')
        );

    }


    public function exportCsv(Request $request)
    {
        $categories = Category::with(['shopMenus'])
            ->orderBy('sort_order')
            ->get();

        $rows = $categories->map(function (Category $category) {
            $payload = $this->formatCategory($category);
            $payload['menu_ids'] = $category->shopMenus->pluck('id')->values()->all();

            return $payload;
        })->values()->all();

        $headers = [];
        foreach ($rows as $row) {
            foreach (array_keys($row) as $key) {
                if (! in_array($key, $headers, true)) {
                    $headers[] = $key;
                }
            }
        }

        if (empty($headers)) {
            $headers = [
                'id', 'parent_id', 'name', 'slug', 'description', 'meta_title', 'meta_description',
                'meta_keywords', 'meta_og_image', 'is_active', 'sort_order', 'menu_ids', 'menus',
                'children', 'created_at', 'updated_at',
            ];
        }

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json([
                'message' => 'Unable to build category CSV export.',
            ], 500);
        }

        fputcsv($stream, $headers);
        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $header) {
                $value = $row[$header] ?? null;
                if (is_array($value) || is_object($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
                $line[] = $value;
            }
            fputcsv($stream, $line);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        $csv = mb_convert_encoding($csv, 'UTF-8', 'UTF-8');
        $csv = "\xEF\xBB\xBF" . $csv;

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="categories_export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($validated['file']->getRealPath(), 'r');
        if (! $handle) {
            return response()->json([
                'message' => 'Unable to open CSV file.',
            ], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json([
                'message' => 'Invalid CSV header row.',
            ], 422);
        }

        $headers = array_map(function ($header) {
            return trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header));
        }, $headers);

        $allowedFields = [
            'parent_id', 'name', 'slug', 'description', 'meta_title', 'meta_description',
            'meta_keywords', 'meta_og_image', 'is_active', 'sort_order', 'menu_ids',
        ];

        $existingSlugs = Category::query()
            ->whereNotNull('slug')
            ->pluck('slug')
            ->map(fn($value) => mb_strtolower(trim((string) $value)))
            ->filter()
            ->all();
        $existingLookup = array_fill_keys($existingSlugs, true);

        $summary = [
            'totalRows' => 0,
            'created' => 0,
            'skipped' => 0,
            'failed' => 0,
            'failedRows' => [],
        ];

        $rowNumber = 1;
        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $isAllEmpty = count(array_filter($cells, fn($v) => trim((string) $v) !== '')) === 0;
            if ($isAllEmpty) {
                continue;
            }

            $summary['totalRows']++;
            $raw = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $raw[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            $slugValue = mb_strtolower(trim((string) ($raw['slug'] ?? '')));
            if ($slugValue === '') {
                $summary['skipped']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => 'Missing unique key: slug',
                ];
                continue;
            }

            if (isset($existingLookup[$slugValue])) {
                $summary['skipped']++;
                continue;
            }

            $payload = [];
            foreach ($raw as $key => $value) {
                if (! in_array($key, $allowedFields, true)) {
                    continue;
                }

                if ($value === '') {
                    $payload[$key] = '';
                    continue;
                }

                if ($key === 'menu_ids') {
                    $decoded = json_decode($value, true);
                    $payload[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
                    continue;
                }

                if (in_array($key, ['parent_id', 'sort_order'], true) && is_numeric($value)) {
                    $payload[$key] = (int) $value;
                    continue;
                }

                if ($key === 'is_active') {
                    $payload[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
                    continue;
                }

                $payload[$key] = $value;
            }

            $validator = Validator::make($payload, [
                'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
                'name' => ['required', 'string', 'max:150'],
                'slug' => ['required', 'string', 'max:150', 'unique:categories,slug'],
                'description' => ['nullable', 'string'],
                'meta_title' => ['nullable', 'string', 'max:255'],
                'meta_description' => ['nullable', 'string'],
                'meta_keywords' => ['nullable', 'string'],
                'meta_og_image' => ['nullable', 'string', 'max:255'],
                'is_active' => ['sometimes', 'boolean'],
                'sort_order' => ['sometimes', 'integer'],
                'menu_ids' => ['array', 'nullable'],
                'menu_ids.*' => ['integer', 'exists:shop_menu_items,id'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => $validator->errors()->first(),
                ];
                continue;
            }

            $clean = $validator->validated();

            try {
                DB::transaction(function () use ($clean, &$existingLookup, &$summary) {
                    $menuIds = $clean['menu_ids'] ?? [];
                    unset($clean['menu_ids']);

                    $category = Category::create($clean + [
                        'is_active' => $clean['is_active'] ?? true,
                    ]);

                    if (is_array($menuIds)) {
                        $category->shopMenus()->sync($menuIds);
                    }

                    $existingLookup[mb_strtolower(trim((string) $category->slug))] = true;
                    $summary['created']++;
                });
            } catch (\Throwable $e) {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => $e->getMessage(),
                ];
            }
        }

        fclose($handle);

        return $this->respond($summary, __('Categories import completed.'));
    }

    public function show(Category $category)
    {
        $category->load(['children.shopMenus', 'shopMenus']);

        return $this->respond($this->formatCategory($category));
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['sometimes', 'string', 'max:150', Rule::unique('categories', 'slug')->ignore($category->id)],
            'description' => ['nullable', 'string'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'menu_ids' => ['array', 'nullable'],
            'menu_ids.*' => ['integer', 'exists:shop_menu_items,id'],
        ]);

        $menuIds = $validated['menu_ids'] ?? [];
        unset($validated['menu_ids']);

        $category->fill($validated);
        $category->save();
        $category->shopMenus()->sync($menuIds);

        return $this->respond(
            $this->formatCategory($category->fresh(['shopMenus'])),
            __('Category updated successfully.')
        );
    }

    public function destroy(Category $category)
    {
        $category->delete();

        return $this->respond(null, __('Category deleted successfully.'));
    }

    protected function formatCategory(Category $category): array
    {
        return [
            'id' => $category->id,
            'parent_id' => $category->parent_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'meta_title' => $category->meta_title,
            'meta_description' => $category->meta_description,
            'meta_keywords' => $category->meta_keywords,
            'meta_og_image' => $category->meta_og_image,
            'is_active' => $category->is_active,
            'sort_order' => $category->sort_order,
            'menu_ids' => $category->shopMenus->pluck('id')->all(),
            'menus' => $category->shopMenus->map(function (ShopMenuItem $menu) {
                return [
                    'id' => $menu->id,
                    'name' => $menu->name,
                    'slug' => $menu->slug,
                ];
            })->all(),
            'children' => $category->relationLoaded('children')
                ? $category->children->map(fn (Category $child) => $this->formatCategory($child))->all()
                : [],
            'created_at' => $category->created_at ? $category->created_at->format('Y-m-d H:i:s') : null,
            'updated_at' => $category->updated_at ? $category->updated_at->format('Y-m-d H:i:s') : null,
        ];
    }
}
