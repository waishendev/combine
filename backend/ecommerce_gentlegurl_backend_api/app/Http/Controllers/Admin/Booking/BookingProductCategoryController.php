<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingProductCategory;
use Illuminate\Http\Request;

class BookingProductCategoryController extends Controller
{
    public function index()
    {
        return $this->respond(
            BookingProductCategory::query()
                ->select(['id', 'name', 'sort_order', 'is_active'])
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        return $this->respond(BookingProductCategory::query()->create($data), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $category = BookingProductCategory::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $category->update($data);
        return $this->respond($category->fresh());
    }

    public function destroy(int $id)
    {
        $category = BookingProductCategory::query()->findOrFail($id);
        $category->update(['is_active' => false]);
        return $this->respond($category->fresh());
    }
}
