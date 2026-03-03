<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ShopMenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ShopMenuItemController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $items = ShopMenuItem::with('categories')
            ->when($request->filled('name'), function ($query) use ($request) {
                $query->where('name', 'like', '%' . $request->get('name') . '%');
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->orderBy('sort_order')
            ->paginate($perPage);

        return $this->respond($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['required', 'string', 'max:150', 'unique:shop_menu_items,slug'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Auto-set sort_order: first item gets 1, subsequent items get max + 1
        $sortOrder = (ShopMenuItem::max('sort_order') ?? 0) + 1;

        $item = ShopMenuItem::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'sort_order' => $sortOrder,
            'is_active' => $validated['is_active'] ?? true,
        ]);
        $item->load('categories');

        return $this->respond($item, __('Shop menu item created successfully.'));
    }


    public function exportCsv(Request $request)
    {
        $items = ShopMenuItem::with('categories')
            ->orderBy('sort_order')
            ->get();

        $rows = $items->map(function (ShopMenuItem $item) {
            $payload = $item->toArray();
            $payload['category_ids'] = $item->categories->pluck('id')->values()->all();

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
            $headers = ['id', 'name', 'slug', 'sort_order', 'is_active', 'category_ids', 'categories', 'created_at', 'updated_at'];
        }

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json([
                'message' => 'Unable to build shop menu CSV export.',
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
            'Content-Disposition' => 'attachment; filename="shop_menu_export_' . now()->format('Y-m-d_His') . '.csv"',
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

        $headers = array_map(fn($header) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)), $headers);

        $allowedFields = ['name', 'slug', 'sort_order', 'is_active'];

        $existingSlugs = ShopMenuItem::query()
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

                if ($key === 'sort_order' && is_numeric($value)) {
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
                'name' => ['required', 'string', 'max:150'],
                'slug' => ['required', 'string', 'max:150', 'unique:shop_menu_items,slug'],
                'sort_order' => ['sometimes', 'integer'],
                'is_active' => ['sometimes', 'boolean'],
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
                    $sortOrder = $clean['sort_order'] ?? ((ShopMenuItem::max('sort_order') ?? 0) + 1);
                    $item = ShopMenuItem::create([
                        'name' => $clean['name'],
                        'slug' => $clean['slug'],
                        'sort_order' => $sortOrder,
                        'is_active' => $clean['is_active'] ?? true,
                    ]);

                    $existingLookup[mb_strtolower(trim((string) $item->slug))] = true;
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

        return $this->respond($summary, __('Shop menu import completed.'));
    }

    public function show(ShopMenuItem $shopMenuItem)
    {
        $shopMenuItem->load('categories');

        return $this->respond($shopMenuItem);
    }

    public function update(Request $request, ShopMenuItem $shopMenuItem)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['sometimes', 'string', 'max:150', Rule::unique('shop_menu_items', 'slug')->ignore($shopMenuItem->id)],
            'sort_order' => ['sometimes', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $shopMenuItem->fill($validated);
        $shopMenuItem->save();
        $shopMenuItem->load('categories');

        return $this->respond($shopMenuItem, __('Shop menu item updated successfully.'));
    }

    public function destroy(ShopMenuItem $shopMenuItem)
    {
        $shopMenuItem->delete();

        return $this->respond(null, __('Shop menu item deleted successfully.'));
    }

    public function moveUp(ShopMenuItem $shopMenuItem)
    {
        return DB::transaction(function () use ($shopMenuItem) {
            $oldPosition = $shopMenuItem->sort_order;

            // Find the previous item (lower sort_order)
            $previousItem = ShopMenuItem::where('sort_order', '<', $shopMenuItem->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousItem) {
                // Already at the top
                return $this->respond(null, __('Shop menu item is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousItem->sort_order;

            $shopMenuItem->sort_order = $newPosition;
            $shopMenuItem->save();

            $previousItem->sort_order = $oldPosition;
            $previousItem->save();

            // Return metadata only
            return $this->respond([
                'id' => $shopMenuItem->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Shop menu item moved up successfully.'));
        });
    }

    public function moveDown(ShopMenuItem $shopMenuItem)
    {
        return DB::transaction(function () use ($shopMenuItem) {
            $oldPosition = $shopMenuItem->sort_order;

            // Find the next item (higher sort_order)
            $nextItem = ShopMenuItem::where('sort_order', '>', $shopMenuItem->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextItem) {
                // Already at the bottom
                return $this->respond(null, __('Shop menu item is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextItem->sort_order;

            $shopMenuItem->sort_order = $newPosition;
            $shopMenuItem->save();

            $nextItem->sort_order = $oldPosition;
            $nextItem->save();

            // Return metadata only
            return $this->respond([
                'id' => $shopMenuItem->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Shop menu item moved down successfully.'));
        });
    }
}
