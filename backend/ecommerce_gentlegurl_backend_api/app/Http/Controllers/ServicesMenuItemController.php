<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\ServicesMenuItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServicesMenuItemController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $items = ServicesMenuItem::with('page')
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
            'slug' => ['required', 'string', 'max:150', 'unique:services_menu_items,slug'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $sortOrder = (ServicesMenuItem::max('sort_order') ?? 0) + 1;

        $item = ServicesMenuItem::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'sort_order' => $sortOrder,
            'is_active' => $validated['is_active'] ?? true,
        ]);
        $item->load('page');

        return $this->respond($item, __('Services menu item created successfully.'));
    }

    public function show(ServicesMenuItem $servicesMenuItem)
    {
        $servicesMenuItem->load('page');

        return $this->respond($servicesMenuItem);
    }

    public function update(Request $request, ServicesMenuItem $servicesMenuItem)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['sometimes', 'string', 'max:150', Rule::unique('services_menu_items', 'slug')->ignore($servicesMenuItem->id)],
            'sort_order' => ['sometimes', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $servicesMenuItem->fill($validated);
        $servicesMenuItem->save();
        $servicesMenuItem->load('page');

        return $this->respond($servicesMenuItem, __('Services menu item updated successfully.'));
    }

    public function destroy(ServicesMenuItem $servicesMenuItem)
    {
        $servicesMenuItem->delete();

        return $this->respond(null, __('Services menu item deleted successfully.'));
    }

    public function moveUp(ServicesMenuItem $servicesMenuItem)
    {
        return DB::transaction(function () use ($servicesMenuItem) {
            $oldPosition = $servicesMenuItem->sort_order;

            $previousItem = ServicesMenuItem::where('sort_order', '<', $servicesMenuItem->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (! $previousItem) {
                return $this->respond(null, __('Services menu item is already at the top.'), false, 400);
            }

            $newPosition = $previousItem->sort_order;

            $servicesMenuItem->sort_order = $newPosition;
            $servicesMenuItem->save();

            $previousItem->sort_order = $oldPosition;
            $previousItem->save();

            return $this->respond([
                'id' => $servicesMenuItem->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Services menu item moved up successfully.'));
        });
    }

    public function moveDown(ServicesMenuItem $servicesMenuItem)
    {
        return DB::transaction(function () use ($servicesMenuItem) {
            $oldPosition = $servicesMenuItem->sort_order;

            $nextItem = ServicesMenuItem::where('sort_order', '>', $servicesMenuItem->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (! $nextItem) {
                return $this->respond(null, __('Services menu item is already at the bottom.'), false, 400);
            }

            $newPosition = $nextItem->sort_order;

            $servicesMenuItem->sort_order = $newPosition;
            $servicesMenuItem->save();

            $nextItem->sort_order = $oldPosition;
            $nextItem->save();

            return $this->respond([
                'id' => $servicesMenuItem->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Services menu item moved down successfully.'));
        });
    }
}
