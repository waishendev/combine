<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingProduct;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Models\Booking\BookingProductCategory;
use Illuminate\Support\Str;

class BookingProductController extends Controller
{
    public function index(Request $request)
    {
        $perPage = max(1, min(200, $request->integer('per_page', 20)));

        $query = BookingProduct::query()
            ->with('category')
            ->leftJoin('booking_product_categories as bpc', 'booking_products.category_id', '=', 'bpc.id')
            ->orderByRaw('COALESCE(bpc.sort_order, 999999) asc')
            ->orderByRaw('COALESCE(booking_products.name, "") asc')
            ->orderBy('booking_products.id');

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%")
                  ->orWhereHas('category', fn($cq) => $cq->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('is_active')) {
            $query->where('booking_products.is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOL));
        }

        if ($request->filled('category_id')) {
            $query->where('booking_products.category_id', (int) $request->input('category_id'));
        }

        return $this->respond($query->select('booking_products.*')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/product-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $product = BookingProduct::create($data);

        return $this->respond($product, 'Created', true, 201);
    }

    public function show(int $id)
    {
        return $this->respond(BookingProduct::findOrFail($id));
    }

    public function update(Request $request, int $id)
    {
        $product = BookingProduct::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'integer', 'exists:booking_product_categories,id'],
            'is_active' => ['sometimes', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $oldImagePath = $product->image_path;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/product-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $product->update($data);

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($product->fresh());
    }

    public function destroy(int $id)
    {
        $product = BookingProduct::findOrFail($id);
        $product->delete();

        return $this->respond(null);
    }
}
