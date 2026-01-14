<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductMedia;
use App\Models\Ecommerce\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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

        return $this->respond($products);
    }

    public function store(Request $request)
    {
        $imageMaxKilobytes = (int) config('ecommerce.product_media.image_max_mb') * 1024;
        $imageExtensions = implode(',', config('ecommerce.product_media.image_extensions'));

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
            'sku' => ['required', 'string', 'max:100', 'unique:products,sku'],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package', 'variant'])],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
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
            'variants.*.price' => ['nullable', 'numeric'],
            'variants.*.cost_price' => ['nullable', 'numeric'],
            'variants.*.stock' => ['nullable', 'integer'],
            'variants.*.track_stock' => ['nullable', 'boolean'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.sort_order' => ['nullable', 'integer'],
            'variants.*.remove_image' => ['nullable', 'boolean'],
            'variant_images' => ['nullable', 'array'],
            'variant_images.*' => ['nullable', 'image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
        ]);

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

        return $this->respond($product->load(['categories', 'images', 'video', 'variants', 'packageChildren']), __('Product created successfully.'));
    }

    public function show(Product $product)
    {
        return $this->respond($product->load(['categories', 'images', 'video', 'variants', 'packageChildren.childProduct']));
    }

    public function update(Request $request, Product $product)
    {
        $imageMaxKilobytes = (int) config('ecommerce.product_media.image_max_mb') * 1024;
        $imageExtensions = implode(',', config('ecommerce.product_media.image_extensions'));

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product->id)],
            'sku' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($product->id)],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package', 'variant'])],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric'],
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
            'variants.*.price' => ['nullable', 'numeric'],
            'variants.*.cost_price' => ['nullable', 'numeric'],
            'variants.*.stock' => ['nullable', 'integer'],
            'variants.*.track_stock' => ['nullable', 'boolean'],
            'variants.*.is_active' => ['nullable', 'boolean'],
            'variants.*.sort_order' => ['nullable', 'integer'],
            'variants.*.remove_image' => ['nullable', 'boolean'],
            'variant_images' => ['nullable', 'array'],
            'variant_images.*' => ['nullable', 'image', "mimes:{$imageExtensions}", "max:{$imageMaxKilobytes}"],
        ]);

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

        return $this->respond($product->load(['categories', 'images', 'video', 'variants', 'packageChildren.childProduct']), __('Product updated successfully.'));
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
                'cost_price' => $variantData['cost_price'] ?? null,
                'stock' => isset($variantData['stock']) ? (int) $variantData['stock'] : 0,
                'track_stock' => filter_var($variantData['track_stock'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'is_active' => filter_var($variantData['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'sort_order' => isset($variantData['sort_order']) ? (int) $variantData['sort_order'] : 0,
            ];

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
}
