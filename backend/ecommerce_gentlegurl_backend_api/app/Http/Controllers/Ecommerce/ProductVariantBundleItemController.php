<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\ProductVariantBundleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductVariantBundleItemController extends Controller
{
    public function index(ProductVariant $variant)
    {
        if (! $variant->is_bundle) {
            throw ValidationException::withMessages([
                'variant' => __('Selected variant is not a bundle option.'),
            ])->status(422);
        }

        $variant->loadMissing('bundleItems.componentVariant');

        $items = $variant->bundleItems->map(function (ProductVariantBundleItem $item) {
            $component = $item->componentVariant;

            return [
                'id' => $item->id,
                'component_variant_id' => $item->component_variant_id,
                'component_variant_name' => $component?->title,
                'component_variant_sku' => $component?->sku,
                'quantity' => $item->quantity,
                'sort_order' => $item->sort_order,
            ];
        })->values();

        return $this->respond($items);
    }

    public function update(Request $request, ProductVariant $variant)
    {
        if (! $variant->is_bundle) {
            throw ValidationException::withMessages([
                'variant' => __('Selected variant is not a bundle option.'),
            ])->status(422);
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.component_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.sort_order' => ['nullable', 'integer'],
        ]);

        $items = $validated['items'];
        $componentIds = collect($items)->pluck('component_variant_id')->filter()->values();

        if ($componentIds->unique()->count() !== $componentIds->count()) {
            throw ValidationException::withMessages([
                'items' => __('Bundle components must be unique.'),
            ])->status(422);
        }

        if ($componentIds->contains($variant->id)) {
            throw ValidationException::withMessages([
                'items' => __('Bundle component cannot reference itself.'),
            ])->status(422);
        }

        $components = ProductVariant::whereIn('id', $componentIds)->get()->keyBy('id');

        foreach ($componentIds as $componentId) {
            $component = $components->get($componentId);
            if (! $component) {
                throw ValidationException::withMessages([
                    'items' => __('Selected component is invalid.'),
                ])->status(422);
            }

            if ($component->product_id !== $variant->product_id) {
                throw ValidationException::withMessages([
                    'items' => __('Bundle components must belong to the same product.'),
                ])->status(422);
            }

            if ($component->is_bundle) {
                throw ValidationException::withMessages([
                    'items' => __('Bundle components must be normal variants.'),
                ])->status(422);
            }
        }

        DB::transaction(function () use ($variant, $items) {
            $variant->bundleItems()->delete();

            foreach ($items as $index => $item) {
                $variant->bundleItems()->create([
                    'component_variant_id' => $item['component_variant_id'],
                    'quantity' => (int) $item['quantity'],
                    'sort_order' => isset($item['sort_order'])
                        ? (int) $item['sort_order']
                        : $index,
                ]);
            }
        });

        $variant->loadMissing('bundleItems.componentVariant');

        return $this->respond($variant->bundleItems->map(function (ProductVariantBundleItem $item) {
            $component = $item->componentVariant;

            return [
                'id' => $item->id,
                'component_variant_id' => $item->component_variant_id,
                'component_variant_name' => $component?->title,
                'component_variant_sku' => $component?->sku,
                'quantity' => $item->quantity,
                'sort_order' => $item->sort_order,
            ];
        })->values(), __('Bundle items updated successfully.'));
    }
}
