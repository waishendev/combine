<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductMedia;
use App\Models\Ecommerce\ProductVariant;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $products = Product::with(['categories', 'images', 'video', 'variants'])
            ->when($request->filled('name'), function ($query) use ($request) {
                $query->where('name', 'like', '%' . $request->get('name') . '%');
            })
            ->when($request->filled('sku'), function ($query) use ($request) {
                $query->where('sku', 'like', '%' . $request->get('sku') . '%');
            })
            ->when($request->filled('category_id'), function ($query) use ($request) {
                $query->whereHas('categories', function ($q) use ($request) {
                    $q->where('categories.id', $request->integer('category_id'));
                });
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->when($request->has('is_reward_only'), function ($query) use ($request) {
                $query->where('is_reward_only', filter_var($request->get('is_reward_only'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->paginate($perPage);

        $products->getCollection()->transform(function (Product $product) {
            $variants = $product->relationLoaded('variants') ? $product->variants : collect();
            $variantPrices = $variants
                ->map(fn(ProductVariant $variant) => $variant->price)
                ->filter(fn($value) => $value !== null)
                ->map(fn($value) => (float) $value)
                ->values();

            $minPrice = $variantPrices->isNotEmpty() ? $variantPrices->min() : null;
            $maxPrice = $variantPrices->isNotEmpty() ? $variantPrices->max() : null;

            $product->setAttribute('min_variant_price', $minPrice);
            $product->setAttribute('max_variant_price', $maxPrice);
            $product->setAttribute('variants_count', $variants->count());

            return $product;
        });

        return $this->respond($products);
    }

    public function store(Request $request)
    {
        $imageMaxKilobytes = (int) config('ecommerce.product_media.image_max_mb') * 1024;
        $imageExtensions = implode(',', config('ecommerce.product_media.image_extensions'));

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
            'sku' => [
                Rule::requiredIf(fn() => $request->input('type') !== 'variant'),
                'nullable',
                'string',
                'max:100',
                'unique:products,sku',
            ],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package', 'variant'])],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'gt:0'],
            'sale_price' => ['nullable', 'numeric', 'gte:0'],
            'sale_price_start_at' => ['nullable', 'date'],
            'sale_price_end_at' => ['nullable', 'date'],
            'cost_price' => ['nullable', 'numeric'],
            'stock' => ['sometimes', 'integer'],
            'low_stock_threshold' => ['sometimes', 'integer'],
            'dummy_sold_count' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'is_reward_only' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable'], // 可以是字符串路径
            'meta_og_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'], // 文件上传
            'category_ids' => ['array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
            'main_image_index' => ['nullable', 'integer', 'min:0'],
            'variants' => ['nullable', 'array'],
            'variants.*.sku' => ['required_with:variants.*.title', 'string', 'max:100'],
            'variants.*.title' => ['required_with:variants.*.sku', 'string', 'max:255'],
            'variants.*.price' => ['nullable', 'numeric', 'gt:0'],
            'variants.*.sale_price' => ['nullable', 'numeric', 'gte:0'],
            'variants.*.sale_price_start_at' => ['nullable', 'date'],
            'variants.*.sale_price_end_at' => ['nullable', 'date'],
            'variants.*.cost_price' => ['nullable', 'numeric'],
            'variants.*.stock' => ['nullable', 'integer'],
            'variants.*.low_stock_threshold' => ['nullable', 'integer'],
            'variants.*.track_stock' => ['nullable', 'boolean'],
            'variants.*.is_bundle' => ['nullable', 'boolean'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.sort_order' => ['nullable', 'integer'],
            'variants.*.remove_image' => ['nullable', 'boolean'],
            'variant_images' => ['nullable', 'array'],
            'variant_images.*' => ['nullable', 'image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
        ]);

        if (($validated['type'] ?? 'single') === 'variant' && empty($validated['sku'])) {
            $validated['sku'] = null;
        }
        $this->validateSalePrice($validated, $request);

        $product = Product::create($validated + [
            'type' => $validated['type'] ?? 'single',
            'is_active' => $validated['is_active'] ?? true,
            'is_featured' => $validated['is_featured'] ?? false,
            'is_reward_only' => $validated['is_reward_only'] ?? false,
            'stock' => $validated['stock'] ?? 0,
            'low_stock_threshold' => $validated['low_stock_threshold'] ?? 0,
            'dummy_sold_count' => $validated['dummy_sold_count'] ?? 0,
        ]);

        if (! empty($validated['category_ids'])) {
            $product->categories()->sync($validated['category_ids']);
        }

        // 处理 meta_og_image 文件上传
        $this->handleMetaOgImageUpload($product, $request);

        // 处理产品图片上传
        $this->handleImageUpload($product, $request);

        $this->syncVariants($product, $request);

        return $this->respond($product->load(['categories', 'images', 'video', 'variants.bundleItems.componentVariant', 'packageChildren']), __('Product created successfully.'));
    }

    public function show(Product $product)
    {
        return $this->respond($product->load(['categories', 'images', 'video', 'variants.bundleItems.componentVariant', 'packageChildren.childProduct']));
    }

    public function update(Request $request, Product $product)
    {
        $imageMaxKilobytes = (int) config('ecommerce.product_media.image_max_mb') * 1024;
        $imageExtensions = implode(',', config('ecommerce.product_media.image_extensions'));

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product->id)],
            'sku' => [
                Rule::requiredIf(fn() => ($request->input('type') ?? $product->type) !== 'variant'),
                'nullable',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->ignore($product->id),
            ],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package', 'variant'])],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'gt:0'],
            'sale_price' => ['nullable', 'numeric', 'gte:0'],
            'sale_price_start_at' => ['nullable', 'date'],
            'sale_price_end_at' => ['nullable', 'date'],
            'cost_price' => ['nullable', 'numeric'],
            'stock' => ['sometimes', 'integer'],
            'low_stock_threshold' => ['sometimes', 'integer'],
            'dummy_sold_count' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'is_reward_only' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable'],
            'meta_og_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
            'main_image_index' => ['nullable', 'integer', 'min:0'],
            'delete_image_ids' => ['nullable', 'array'],
            'delete_image_ids.*' => ['integer', 'exists:product_media,id'],
            'variants' => ['sometimes', 'array'],
            'variants.*.id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'variants.*.sku' => ['required_with:variants.*.title', 'string', 'max:100'],
            'variants.*.title' => ['required_with:variants.*.sku', 'string', 'max:255'],
            'variants.*.price' => ['nullable', 'numeric', 'gt:0'],
            'variants.*.sale_price' => ['nullable', 'numeric', 'gte:0'],
            'variants.*.sale_price_start_at' => ['nullable', 'date'],
            'variants.*.sale_price_end_at' => ['nullable', 'date'],
            'variants.*.cost_price' => ['nullable', 'numeric'],
            'variants.*.stock' => ['nullable', 'integer'],
            'variants.*.low_stock_threshold' => ['nullable', 'integer'],
            'variants.*.track_stock' => ['nullable', 'boolean'],
            'variants.*.is_bundle' => ['nullable', 'boolean'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.sort_order' => ['nullable', 'integer'],
            'variants.*.remove_image' => ['nullable', 'boolean'],
            'variant_images' => ['nullable', 'array'],
            'variant_images.*' => ['nullable', 'image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
        ]);

        if (($validated['type'] ?? $product->type) === 'variant' && array_key_exists('sku', $validated) && empty($validated['sku'])) {
            $validated['sku'] = null;
        }
        $this->validateSalePrice($validated, $request, $product);

        $product->fill($validated);
        $product->dummy_sold_count = $request->has('dummy_sold_count')
            ? ($validated['dummy_sold_count'] ?? 0)
            : ($product->dummy_sold_count ?? 0);
        $product->save();

        if ($request->has('category_ids')) {
            $product->categories()->sync($validated['category_ids'] ?? []);
        }

        // 处理 meta_og_image 文件上传或更新
        $this->handleMetaOgImageUpload($product, $request);

        // 处理删除的图片
        if ($request->has('delete_image_ids') && ! empty($validated['delete_image_ids'])) {
            $this->deleteImages($product, $validated['delete_image_ids']);
        }

        // 处理新上传的图片
        if ($request->hasFile('images')) {
            $this->handleImageUpload($product, $request);
        }

        $this->syncVariants($product, $request);

        return $this->respond($product->load(['categories', 'images', 'video', 'variants.bundleItems.componentVariant', 'packageChildren.childProduct']), __('Product updated successfully.'));
    }


    public function exportCsv(Request $request)
    {
        $products = Product::with(['categories', 'images', 'video', 'variants.bundleItems'])
            ->when($request->has('is_reward_only'), function ($query) use ($request) {
                $query->where('is_reward_only', filter_var($request->get('is_reward_only'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->get();

        $rows = $products->map(function (Product $product) {
            $payload = $product->toArray();
            $payload['category_ids'] = $product->categories->pluck('id')->values()->all();

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
                'id', 'name', 'slug', 'sku', 'type', 'description', 'price', 'sale_price',
                'sale_price_start_at', 'sale_price_end_at', 'cost_price', 'stock', 'low_stock_threshold',
                'track_stock', 'dummy_sold_count', 'is_active', 'is_featured', 'is_reward_only',
                'meta_title', 'meta_description', 'meta_keywords', 'meta_og_image',
                'created_at', 'updated_at', 'category_ids', 'categories', 'images', 'video', 'variants',
            ];
        }

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json([
                'message' => 'Unable to build CSV export.',
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
            'Content-Disposition' => 'attachment; filename="products_export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $file = $validated['file'];
        $handle = fopen($file->getRealPath(), 'r');

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
            'name', 'slug', 'sku', 'type', 'description', 'price', 'sale_price', 'sale_price_start_at',
            'sale_price_end_at', 'cost_price', 'stock', 'low_stock_threshold', 'track_stock', 'dummy_sold_count',
            'is_active', 'is_featured', 'is_reward_only', 'meta_title', 'meta_description', 'meta_keywords',
            'meta_og_image', 'category_ids', 'variants',
        ];

        $hasSkuHeader = in_array('sku', $headers, true);
        $hasSlugHeader = in_array('slug', $headers, true);

        $existingSkus = Product::query()
            ->whereNotNull('sku')
            ->pluck('sku')
            ->map(fn($value) => mb_strtolower(trim((string) $value)))
            ->filter()
            ->all();
        $existingSlugs = Product::query()
            ->whereNotNull('slug')
            ->pluck('slug')
            ->map(fn($value) => mb_strtolower(trim((string) $value)))
            ->filter()
            ->all();

        $existingSkuLookup = array_fill_keys($existingSkus, true);
        $existingSlugLookup = array_fill_keys($existingSlugs, true);

        $categories = Category::query()->get(['id', 'slug', 'name']);
        $existingCategoryIds = array_fill_keys($categories->pluck('id')->all(), true);
        $categorySlugToId = $categories
            ->filter(fn(Category $category) => ! empty($category->slug))
            ->mapWithKeys(fn(Category $category) => [mb_strtolower(trim((string) $category->slug)) => $category->id])
            ->all();
        $categoryNameToId = $categories
            ->filter(fn(Category $category) => ! empty($category->name))
            ->mapWithKeys(fn(Category $category) => [mb_strtolower(trim((string) $category->name)) => $category->id])
            ->all();

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

            $skuUniqueValue = mb_strtolower(trim((string) ($raw['sku'] ?? '')));
            $slugUniqueValue = mb_strtolower(trim((string) ($raw['slug'] ?? '')));

            $uniqueValue = $skuUniqueValue !== '' ? $skuUniqueValue : $slugUniqueValue;
            $uniqueField = $skuUniqueValue !== '' ? 'sku' : 'slug';

            if ($uniqueValue === '') {
                $missingKey = $hasSkuHeader ? 'sku/slug' : ($hasSlugHeader ? 'slug' : 'sku/slug');
                $summary['skipped']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => "Missing unique key: {$missingKey}",
                ];
                continue;
            }

            $exists = $uniqueField === 'sku'
                ? isset($existingSkuLookup[$uniqueValue])
                : isset($existingSlugLookup[$uniqueValue]);

            if ($exists) {
                $summary['skipped']++;
                continue;
            }

            $nullableFields = [
                'sku',
                'sale_price',
                'sale_price_start_at',
                'sale_price_end_at',
                'cost_price',
                'description',
                'meta_title',
                'meta_description',
                'meta_keywords',
                'meta_og_image',
                'dummy_sold_count',
            ];

            $booleanFields = ['track_stock', 'is_active', 'is_featured', 'is_reward_only'];

            $payload = [];
            foreach ($raw as $key => $value) {
                if (! in_array($key, $allowedFields, true)) {
                    continue;
                }

                if ($value === '') {
                    if ($key === 'category_ids') {
                        $payload[$key] = [];
                    } elseif ($key === 'variants') {
                        $payload[$key] = [];
                    } elseif (in_array($key, $nullableFields, true)) {
                        $payload[$key] = null;
                    }
                    continue;
                }

                if (in_array($key, ['category_ids', 'variants'], true)) {
                    $decoded = json_decode($value, true);
                    $payload[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
                    continue;
                }

                if (in_array($key, ['price', 'sale_price', 'cost_price'], true) && is_numeric($value)) {
                    $payload[$key] = (float) $value;
                    continue;
                }

                if (in_array($key, ['stock', 'low_stock_threshold', 'dummy_sold_count'], true) && is_numeric($value)) {
                    $payload[$key] = (int) $value;
                    continue;
                }

                if (in_array($key, $booleanFields, true)) {
                    $normalized = mb_strtolower(trim((string) $value));
                    if (in_array($normalized, ['1', 'true', 'yes'], true)) {
                        $payload[$key] = true;
                    } elseif (in_array($normalized, ['0', 'false', 'no'], true)) {
                        $payload[$key] = false;
                    } else {
                        $payload[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    }
                    continue;
                }

                $payload[$key] = $value;
            }

            if (array_key_exists('category_ids', $payload) && is_array($payload['category_ids'])) {
                $categoryMetaList = [];
                if (! empty($raw['categories'])) {
                    $decodedCategories = json_decode((string) $raw['categories'], true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decodedCategories)) {
                        $categoryMetaList = $decodedCategories;
                    }
                }

                $resolvedCategoryIds = [];

                if (! empty($categoryMetaList)) {
                    foreach ($categoryMetaList as $categoryMeta) {
                        if (! is_array($categoryMeta)) {
                            continue;
                        }

                        $mappedId = null;
                        $metaId = $categoryMeta['id'] ?? null;
                        if (is_numeric($metaId) && isset($existingCategoryIds[(int) $metaId])) {
                            $mappedId = (int) $metaId;
                        }

                        if ($mappedId === null) {
                            $categorySlug = mb_strtolower(trim((string) ($categoryMeta['slug'] ?? '')));
                            if ($categorySlug !== '' && isset($categorySlugToId[$categorySlug])) {
                                $mappedId = $categorySlugToId[$categorySlug];
                            }
                        }

                        if ($mappedId === null) {
                            $categoryName = mb_strtolower(trim((string) ($categoryMeta['name'] ?? '')));
                            if ($categoryName !== '' && isset($categoryNameToId[$categoryName])) {
                                $mappedId = $categoryNameToId[$categoryName];
                            }
                        }

                        if ($mappedId !== null) {
                            $resolvedCategoryIds[] = (int) $mappedId;
                            continue;
                        }

                        $summary['failed']++;
                        $summary['failedRows'][] = [
                            'row' => $rowNumber,
                            'reason' => 'Unable to map categories JSON data to current categories.',
                        ];
                        continue 2;
                    }
                } else {
                    foreach ($payload['category_ids'] as $categoryId) {
                        if (is_numeric($categoryId) && isset($existingCategoryIds[(int) $categoryId])) {
                            $resolvedCategoryIds[] = (int) $categoryId;
                            continue;
                        }

                        $summary['failed']++;
                        $summary['failedRows'][] = [
                            'row' => $rowNumber,
                            'reason' => 'Unable to map category_ids from import data.',
                        ];
                        continue 2;
                    }
                }

                $payload['category_ids'] = array_values(array_unique($resolvedCategoryIds));
            }

            $validator = Validator::make($payload, [
                'name' => ['required', 'string', 'max:255'],
                'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
                'sku' => [
                    Rule::requiredIf(fn() => ($payload['type'] ?? 'single') !== 'variant'),
                    'nullable',
                    'string',
                    'max:100',
                    'unique:products,sku',
                ],
                'type' => ['sometimes', 'string', Rule::in(['single', 'package', 'variant'])],
                'description' => ['nullable', 'string'],
                'price' => ['required', 'numeric', 'gt:0'],
                'sale_price' => ['nullable', 'numeric', 'gte:0'],
                'sale_price_start_at' => ['nullable', 'date'],
                'sale_price_end_at' => ['nullable', 'date'],
                'cost_price' => ['nullable', 'numeric'],
                'stock' => ['sometimes', 'integer'],
                'low_stock_threshold' => ['sometimes', 'integer'],
                'dummy_sold_count' => ['nullable', 'integer', 'min:0', 'max:999999'],
                'is_active' => ['sometimes', 'boolean'],
                'is_featured' => ['sometimes', 'boolean'],
                'is_reward_only' => ['sometimes', 'boolean'],
                'meta_title' => ['nullable', 'string', 'max:255'],
                'meta_description' => ['nullable', 'string'],
                'meta_keywords' => ['nullable', 'string'],
                'meta_og_image' => ['nullable'],
                'category_ids' => ['array'],
                'category_ids.*' => ['integer', 'exists:categories,id'],
                'variants' => ['nullable', 'array'],
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
                DB::transaction(function () use ($clean, &$existingSkuLookup, &$existingSlugLookup, &$summary) {
                    $product = Product::create($clean + [
                        'type' => $clean['type'] ?? 'single',
                        'is_active' => $clean['is_active'] ?? true,
                        'is_featured' => $clean['is_featured'] ?? false,
                        'is_reward_only' => $clean['is_reward_only'] ?? false,
                        'stock' => $clean['stock'] ?? 0,
                        'low_stock_threshold' => $clean['low_stock_threshold'] ?? 0,
                        'dummy_sold_count' => $clean['dummy_sold_count'] ?? 0,
                    ]);

                    if (! empty($clean['category_ids']) && is_array($clean['category_ids'])) {
                        $product->categories()->sync($clean['category_ids']);
                    }

                    if (! empty($clean['variants']) && is_array($clean['variants'])) {
                        foreach ($clean['variants'] as $variantData) {
                            if (! is_array($variantData)) {
                                continue;
                            }
                            $product->variants()->create([
                                'sku' => $variantData['sku'] ?? null,
                                'title' => $variantData['title'] ?? ($variantData['name'] ?? null),
                                'price' => isset($variantData['price']) ? (float) $variantData['price'] : null,
                                'sale_price' => isset($variantData['sale_price']) ? (float) $variantData['sale_price'] : null,
                                'sale_price_start_at' => $variantData['sale_price_start_at'] ?? null,
                                'sale_price_end_at' => $variantData['sale_price_end_at'] ?? null,
                                'cost_price' => isset($variantData['cost_price']) ? (float) $variantData['cost_price'] : null,
                                'stock' => isset($variantData['stock']) ? (int) $variantData['stock'] : 0,
                                'low_stock_threshold' => isset($variantData['low_stock_threshold']) ? (int) $variantData['low_stock_threshold'] : 0,
                                'track_stock' => filter_var($variantData['track_stock'] ?? true, FILTER_VALIDATE_BOOLEAN),
                                'is_bundle' => filter_var($variantData['is_bundle'] ?? false, FILTER_VALIDATE_BOOLEAN),
                                'is_active' => filter_var($variantData['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN),
                                'sort_order' => isset($variantData['sort_order']) ? (int) $variantData['sort_order'] : 0,
                            ]);
                        }
                    }

                    if (! empty($product->sku)) {
                        $existingSkuLookup[mb_strtolower(trim((string) $product->sku))] = true;
                    }
                    if (! empty($product->slug)) {
                        $existingSlugLookup[mb_strtolower(trim((string) $product->slug))] = true;
                    }

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

        return $this->respond($summary, __('Products import completed.'));
    }

    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:products,id'],
            'price' => ['nullable', 'numeric', 'gt:0'],
            'sale_price' => ['nullable', 'numeric', 'gte:0'],
            'sale_price_start_at' => ['nullable', 'date'],
            'sale_price_end_at' => ['nullable', 'date'],
            'cost_price' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'integer'],
            'low_stock_threshold' => ['nullable', 'integer'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        $products = Product::whereIn('id', $validated['ids'])->get();
        $payload = collect($validated)->except('ids')->toArray();

        foreach ($products as $product) {
            if (array_key_exists('category_ids', $payload)) {
                $product->categories()->sync($payload['category_ids'] ?? []);
            }

            if (array_key_exists('sale_price', $payload)) {
                $price = array_key_exists('price', $payload)
                    ? (float) $payload['price']
                    : (float) $product->price;
                $salePrice = $payload['sale_price'];

                if ($salePrice !== null && (! $price || (float) $salePrice >= $price)) {
                    throw ValidationException::withMessages([
                        'sale_price' => __('Sale price must be less than original price.'),
                    ])->status(422);
                }
            }

            if (
                array_key_exists('sale_price_start_at', $payload)
                || array_key_exists('sale_price_end_at', $payload)
            ) {
                $startAt = $payload['sale_price_start_at'] ?? $product->sale_price_start_at;
                $endAt = $payload['sale_price_end_at'] ?? $product->sale_price_end_at;

                if ($startAt && $endAt && Carbon::parse($startAt)->gt(Carbon::parse($endAt))) {
                    throw ValidationException::withMessages([
                        'sale_price_start_at' => __('Sale price start must be before end time.'),
                    ])->status(422);
                }
            }

            if (! empty($payload)) {
                $product->fill(collect($payload)->except('category_ids')->toArray());
                $product->save();
            }
        }

        return $this->respond($products, __('Products updated successfully.'));
    }

    public function destroy(Product $product)
    {
        // 删除产品时，同时删除所有媒体文件
        foreach ($product->media as $media) {
            $mediaPath = $media->getRawOriginal('path');
            if ($mediaPath && Storage::disk($media->disk)->exists($mediaPath)) {
                Storage::disk($media->disk)->delete($mediaPath);
            }

            $thumbnailPath = $media->getRawOriginal('thumbnail_path');
            if ($thumbnailPath && Storage::disk($media->disk)->exists($thumbnailPath)) {
                Storage::disk($media->disk)->delete($thumbnailPath);
            }
        }

        // 删除 meta_og_image 文件（如果是上传的文件）
        // 使用原始属性值（相对路径），而不是 accessor 返回的 URL
        $metaOgImage = $product->getRawOriginal('meta_og_image');
        if ($metaOgImage && str_starts_with($metaOgImage, 'products/')) {
            if (Storage::disk('public')->exists($metaOgImage)) {
                Storage::disk('public')->delete($metaOgImage);
            }
        }

        $product->delete();

        return $this->respond(null, __('Product deleted successfully.'));
    }

    /**
     * 处理产品图片上传
     */
    protected function handleImageUpload(Product $product, Request $request): void
    {
        if (! $request->hasFile('images')) {
            return;
        }

        $images = $request->file('images');
        $existingImagesCount = $product->images()->count();

        foreach ($images as $index => $image) {
            $filename = sprintf(
                'products/%s/images/%s.%s',
                $product->id,
                Str::uuid(),
                $image->getClientOriginalExtension()
            );

            $path = $image->storeAs('', $filename, 'public');

            ProductMedia::create([
                'product_id' => $product->id,
                'type' => 'image',
                'disk' => 'public',
                'path' => $path,
                'sort_order' => $existingImagesCount + $index,
                'mime_type' => $image->getMimeType() ?? 'image/jpeg',
                'size_bytes' => $image->getSize() ?? 0,
                'status' => 'ready',
            ]);
        }
    }

    protected function syncVariants(Product $product, Request $request): void
    {
        $variantsInput = $request->input('variants');

        if ($product->type !== 'variant') {
            if ($request->has('variants') || $product->variants()->exists()) {
                $this->deleteVariants($product, []);
            }
            return;
        }

        if (! $request->has('variants')) {
            return;
        }

        $variantFiles = $request->file('variant_images', []);
        $keepIds = [];

        foreach ($variantsInput ?? [] as $index => $variantData) {
            if (! is_array($variantData)) {
                continue;
            }

            $variantId = $variantData['id'] ?? null;
            $variant = $variantId
                ? $product->variants()->where('id', $variantId)->first()
                : new ProductVariant(['product_id' => $product->id]);

            if (! $variant) {
                continue;
            }

            $payload = [
                'sku' => $variantData['sku'] ?? $variant->sku,
                'title' => $variantData['title'] ?? $variant->title,
                'price' => $variantData['price'] ?? null,
                'sale_price' => $variantData['sale_price'] ?? null,
                'sale_price_start_at' => $variantData['sale_price_start_at'] ?? null,
                'sale_price_end_at' => $variantData['sale_price_end_at'] ?? null,
                'cost_price' => $variantData['cost_price'] ?? null,
                'stock' => isset($variantData['stock']) ? (int) $variantData['stock'] : 0,
                'low_stock_threshold' => isset($variantData['low_stock_threshold']) ? (int) $variantData['low_stock_threshold'] : 0,
                'track_stock' => filter_var($variantData['track_stock'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'is_bundle' => filter_var($variantData['is_bundle'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'is_active' => filter_var($variantData['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'sort_order' => isset($variantData['sort_order']) ? (int) $variantData['sort_order'] : 0,
            ];

            if (!empty($payload['is_bundle'])) {
                $payload['stock'] = 0;
                $payload['low_stock_threshold'] = 0;
                $payload['track_stock'] = true;
            }

            if (! empty($variantData['remove_image'])) {
                $this->deleteVariantImage($variant);
                $payload['image_path'] = null;
            }

            if (isset($variantFiles[$index])) {
                $this->deleteVariantImage($variant);
                $file = $variantFiles[$index];
                $filename = sprintf(
                    'products/%s/variants/%s.%s',
                    $product->id,
                    Str::uuid(),
                    $file->getClientOriginalExtension()
                );
                $payload['image_path'] = $file->storeAs('', $filename, 'public');
            }

            $variant->fill($payload);
            $variant->product_id = $product->id;
            $variant->save();

            $keepIds[] = $variant->id;
        }

        $this->deleteVariants($product, $keepIds);
    }

    protected function deleteVariants(Product $product, array $keepIds): void
    {
        $variantsToDelete = $product->variants()
            ->when(! empty($keepIds), fn($query) => $query->whereNotIn('id', $keepIds))
            ->get();

        foreach ($variantsToDelete as $variant) {
            $this->deleteVariantImage($variant);
            $variant->delete();
        }
    }

    protected function deleteVariantImage(ProductVariant $variant): void
    {
        $path = $variant->getRawOriginal('image_path');
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * 删除产品图片
     */
    protected function deleteImages(Product $product, array $imageIds): void
    {
        $images = $product->images()->whereIn('id', $imageIds)->get();

        foreach ($images as $image) {
            $imagePath = $image->getRawOriginal('path');

            if ($imagePath && Storage::disk($image->disk)->exists($imagePath)) {
                Storage::disk($image->disk)->delete($imagePath);
            }

            $image->delete();
        }
    }

    /**
     * 处理 meta_og_image 文件上传
     */
    protected function handleMetaOgImageUpload(Product $product, Request $request): void
    {
        // 如果上传了文件，优先使用文件
        if ($request->hasFile('meta_og_image_file')) {
            $file = $request->file('meta_og_image_file');

            // 删除旧的 meta_og_image 文件（如果是之前上传的文件）
            // 使用原始属性值（相对路径），而不是 accessor 返回的 URL
            $oldMetaOgImage = $product->getRawOriginal('meta_og_image');
            if ($oldMetaOgImage && str_starts_with($oldMetaOgImage, 'products/')) {
                if (Storage::disk('public')->exists($oldMetaOgImage)) {
                    Storage::disk('public')->delete($oldMetaOgImage);
                }
            }

            // 生成唯一的文件名
            $filename = 'products/' . $product->id . '/og_' . uniqid() . '.' . $file->getClientOriginalExtension();

            // 存储文件到 public 磁盘
            $path = $file->storeAs('', $filename, 'public');

            // 更新产品的 meta_og_image 字段
            $product->meta_og_image = $path;
            $product->save();
        } elseif ($request->has('meta_og_image')) {
            // 如果提供了字符串路径，直接使用
            $metaOgImage = $request->input('meta_og_image');

            // 使用原始属性值进行比较和删除
            $oldMetaOgImage = $product->getRawOriginal('meta_og_image');

            // 如果传入的是空字符串，删除旧的文件
            if (empty($metaOgImage)) {
                // 删除旧的 meta_og_image 文件（如果是之前上传的文件）
                if ($oldMetaOgImage && str_starts_with($oldMetaOgImage, 'products/')) {
                    if (Storage::disk('public')->exists($oldMetaOgImage)) {
                        Storage::disk('public')->delete($oldMetaOgImage);
                    }
                }
                $product->meta_og_image = null;
                $product->save();
            } elseif ($metaOgImage !== $oldMetaOgImage) {
                // 如果路径不同，且不是上传的文件路径，直接更新
                // 如果是从上传的文件路径改为外部 URL，删除旧文件
                if ($oldMetaOgImage && str_starts_with($oldMetaOgImage, 'products/')) {
                    if (Storage::disk('public')->exists($oldMetaOgImage)) {
                        Storage::disk('public')->delete($oldMetaOgImage);
                    }
                }
                $product->meta_og_image = $metaOgImage;
                $product->save();
            }
        }
    }

    protected function validateSalePrice(array $validated, Request $request, ?Product $product = null): void
    {
        if (array_key_exists('sale_price', $validated)) {
            $price = array_key_exists('price', $validated)
                ? (float) $validated['price']
                : (float) ($product?->price ?? 0);
            $salePrice = $validated['sale_price'];

            if ($salePrice !== null) {
                if (! $price || (float) $salePrice >= $price) {
                    throw ValidationException::withMessages([
                        'sale_price' => __('Sale price must be less than original price.'),
                    ])->status(422);
                }
            }
        }

        if (array_key_exists('sale_price_start_at', $validated) || array_key_exists('sale_price_end_at', $validated)) {
            $startAt = $validated['sale_price_start_at'] ?? $product?->sale_price_start_at;
            $endAt = $validated['sale_price_end_at'] ?? $product?->sale_price_end_at;

            if ($startAt && $endAt && Carbon::parse($startAt)->gt(Carbon::parse($endAt))) {
                throw ValidationException::withMessages([
                    'sale_price_start_at' => __('Sale price start must be before end time.'),
                ])->status(422);
            }
        }

        if (! $request->has('variants')) {
            return;
        }

        $variants = $validated['variants'] ?? $request->input('variants', []);
        foreach ($variants as $index => $variantData) {
            if (! is_array($variantData)) {
                continue;
            }

            $variantStartAt = $variantData['sale_price_start_at'] ?? null;
            $variantEndAt = $variantData['sale_price_end_at'] ?? null;

            if ($variantStartAt && $variantEndAt && Carbon::parse($variantStartAt)->gt(Carbon::parse($variantEndAt))) {
                throw ValidationException::withMessages([
                    "variants.{$index}.sale_price_start_at" => __('Variant sale price start must be before end time.'),
                ])->status(422);
            }

            if (! array_key_exists('sale_price', $variantData) || $variantData['sale_price'] === null) {
                continue;
            }

            $variantPrice = $variantData['price'] ?? null;
            if ($variantPrice === null && $product && ! empty($variantData['id'])) {
                $existingVariant = $product->variants()->where('id', $variantData['id'])->first();
                $variantPrice = $existingVariant?->price;
            }

            if (! $variantPrice || (float) $variantData['sale_price'] >= (float) $variantPrice) {
                throw ValidationException::withMessages([
                    "variants.{$index}.sale_price" => __('Variant sale price must be less than variant price.'),
                ])->status(422);
            }
        }
    }
}
