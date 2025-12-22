<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $products = Product::with(['categories', 'images'])
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
            ->paginate($perPage);

        return $this->respond($products);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:products,slug'],
            'sku' => ['required', 'string', 'max:100', 'unique:products,sku'],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package'])],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric'],
            'cost_price' => ['nullable', 'numeric'],
            'stock' => ['sometimes', 'integer'],
            'low_stock_threshold' => ['sometimes', 'integer'],
            'dummy_sold_count' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable'], // 可以是字符串路径
            'meta_og_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'], // 文件上传
            'category_ids' => ['array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'], // 最大 5MB
            'main_image_index' => ['nullable', 'integer', 'min:0'],
        ]);

        $product = Product::create($validated + [
            'type' => $validated['type'] ?? 'single',
            'is_active' => $validated['is_active'] ?? true,
            'is_featured' => $validated['is_featured'] ?? false,
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

        return $this->respond($product->load(['categories', 'images', 'packageChildren']), __('Product created successfully.'));
    }

    public function show(Product $product)
    {
        return $this->respond($product->load(['categories', 'images', 'packageChildren.childProduct']));
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product->id)],
            'sku' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($product->id)],
            'type' => ['sometimes', 'string', Rule::in(['single', 'package'])],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric'],
            'cost_price' => ['nullable', 'numeric'],
            'stock' => ['sometimes', 'integer'],
            'low_stock_threshold' => ['sometimes', 'integer'],
            'dummy_sold_count' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
            'meta_og_image' => ['nullable'],
            'meta_og_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'main_image_index' => ['nullable', 'integer', 'min:0'],
            'delete_image_ids' => ['nullable', 'array'],
            'delete_image_ids.*' => ['integer', 'exists:product_images,id'],
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

        return $this->respond($product->load(['categories', 'images', 'packageChildren.childProduct']), __('Product updated successfully.'));
    }

    public function destroy(Product $product)
    {
        // 删除产品时，同时删除所有图片文件
        foreach ($product->images as $image) {
            if (Storage::disk('public')->exists($image->image_path)) {
                Storage::disk('public')->delete($image->image_path);
            }
        }

        // 删除 meta_og_image 文件（如果是上传的文件）
        if ($product->meta_og_image && str_starts_with($product->meta_og_image, 'products/')) {
            if (Storage::disk('public')->exists($product->meta_og_image)) {
                Storage::disk('public')->delete($product->meta_og_image);
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
        $mainImageIndex = $request->integer('main_image_index', null);

        // 获取当前产品已有的主图片数量，用于设置 sort_order
        $existingImagesCount = $product->images()->count();
        $hasExistingMainImage = $product->images()->where('is_main', true)->exists();

        foreach ($images as $index => $image) {
            // 生成唯一的文件名
            $filename = 'products/' . $product->id . '/' . uniqid() . '.' . $image->getClientOriginalExtension();

            // 存储图片到 public 磁盘
            $path = $image->storeAs('', $filename, 'public');

            // 判断是否为主图片
            // 如果没有指定主图片索引，且没有现有主图片，则第一个自动成为主图片
            if ($mainImageIndex === null && ! $hasExistingMainImage && $index === 0) {
                $isMain = true;
            } else {
                $isMain = $mainImageIndex !== null && $index === $mainImageIndex;
            }

            // 如果设置了新的主图片，先取消其他主图片
            if ($isMain) {
                $product->images()->update(['is_main' => false]);
                $hasExistingMainImage = true; // 标记已有主图片，后续图片不再自动设置
            }

            // 创建图片记录
            ProductImage::create([
                'product_id' => $product->id,
                'image_path' => $path,
                'is_main' => $isMain,
                'sort_order' => $existingImagesCount + $index,
            ]);
        }
    }

    /**
     * 删除产品图片
     */
    protected function deleteImages(Product $product, array $imageIds): void
    {
        $images = $product->images()->whereIn('id', $imageIds)->get();

        foreach ($images as $image) {
            // 删除文件
            if (Storage::disk('public')->exists($image->image_path)) {
                Storage::disk('public')->delete($image->image_path);
            }

            // 删除数据库记录
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
            if ($product->meta_og_image && str_starts_with($product->meta_og_image, 'products/')) {
                if (Storage::disk('public')->exists($product->meta_og_image)) {
                    Storage::disk('public')->delete($product->meta_og_image);
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

            // 如果传入的是空字符串，删除旧的文件
            if (empty($metaOgImage)) {
                // 删除旧的 meta_og_image 文件（如果是之前上传的文件）
                if ($product->meta_og_image && str_starts_with($product->meta_og_image, 'products/')) {
                    if (Storage::disk('public')->exists($product->meta_og_image)) {
                        Storage::disk('public')->delete($product->meta_og_image);
                    }
                }
                $product->meta_og_image = null;
                $product->save();
            } elseif ($metaOgImage !== $product->meta_og_image) {
                // 如果路径不同，且不是上传的文件路径，直接更新
                // 如果是从上传的文件路径改为外部 URL，删除旧文件
                if ($product->meta_og_image && str_starts_with($product->meta_og_image, 'products/')) {
                    if (Storage::disk('public')->exists($product->meta_og_image)) {
                        Storage::disk('public')->delete($product->meta_og_image);
                    }
                }
                $product->meta_og_image = $metaOgImage;
                $product->save();
            }
        }
    }
}
