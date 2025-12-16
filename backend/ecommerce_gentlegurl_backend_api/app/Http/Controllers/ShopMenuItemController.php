<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ShopMenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
