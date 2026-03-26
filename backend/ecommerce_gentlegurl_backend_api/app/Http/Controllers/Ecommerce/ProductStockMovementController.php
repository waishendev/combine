<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\ProductStockMovement;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductStockMovementController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'type' => ['nullable', Rule::in(['stock_in', 'stock_out'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);

        $query = ProductStockMovement::query()
            ->with([
                'product:id,name,sku',
                'variant:id,title,sku,is_bundle',
                'createdBy:id,name,email',
            ])
            ->when(isset($validated['product_id']), function ($builder) use ($validated) {
                $builder->where('product_id', (int) $validated['product_id']);
            })
            ->when(isset($validated['type']), function ($builder) use ($validated) {
                $builder->where('type', $validated['type']);
            })
            ->when(isset($validated['date_from']), function ($builder) use ($validated) {
                $builder->whereDate('created_at', '>=', $validated['date_from']);
            })
            ->when(isset($validated['date_to']), function ($builder) use ($validated) {
                $builder->whereDate('created_at', '<=', $validated['date_to']);
            })
            ->latest('id');

        return $this->respond($query->paginate($perPage));
    }
}
