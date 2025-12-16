<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\ShopMenuItem;
use Illuminate\Http\Request;
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
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
        ];
    }
}
