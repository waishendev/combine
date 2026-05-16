<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductStockMovement;
use App\Models\Ecommerce\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductStockMovementController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'type' => ['nullable', Rule::in(['stock_in', 'stock_out', 'reversal'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'revokable_only' => ['nullable', 'boolean'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);

        $query = ProductStockMovement::query()
            ->with([
                'product:id,name,sku',
                'variant:id,title,sku,is_bundle',
                'createdBy:id,name,email',
                'revokedBy:id,name,email',
                'originalMovement:id,type,quantity_change,created_at',
                'reversalMovement:id,type,quantity_change,created_at',
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
            ->when((bool) ($validated['revokable_only'] ?? false), function ($builder) {
                $builder->whereIn('type', ['stock_in', 'stock_out'])
                    ->where('is_revoked', false)
                    ->whereNull('reversal_of_movement_id')
                    ->whereDoesntHave('reversalMovement')
                    ->where(function ($nested) {
                        $nested->whereNull('remark')
                            ->orWhereRaw('LOWER(TRIM(remark)) != ?', ['pos checkout']);
                    });
            })
            ->latest('id');

        return $this->respond($query->paginate($perPage));
    }

    public function revoke(Request $request, int $id)
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        $result = DB::transaction(function () use ($id, $request, $validated) {
            $movement = ProductStockMovement::query()
                ->whereKey($id)
                ->lockForUpdate()
                ->first();

            if (! $movement) {
                throw ValidationException::withMessages([
                    'movement' => [__('Stock movement record was not found.')],
                ])->status(404);
            }

            $this->ensureMovementCanBeRevoked($movement);

            $lockedProduct = Product::query()
                ->whereKey($movement->product_id)
                ->lockForUpdate()
                ->firstOrFail();

            $lockedVariant = null;
            if ($movement->product_variant_id) {
                $lockedVariant = ProductVariant::query()
                    ->whereKey($movement->product_variant_id)
                    ->where('product_id', $lockedProduct->id)
                    ->lockForUpdate()
                    ->first();

                if (! $lockedVariant) {
                    throw ValidationException::withMessages([
                        'movement' => [__('The stock movement variant no longer exists for this product.')],
                    ]);
                }

                if ($lockedVariant->is_bundle) {
                    throw ValidationException::withMessages([
                        'movement' => [__('Bundle stock is derived from component variants and cannot be reversed directly.')],
                    ]);
                }
            }

            $beforeQty = $lockedVariant
                ? (int) ($lockedVariant->stock ?? 0)
                : $lockedProduct->resolvedStockQuantity();
            $beforeCost = $lockedVariant
                ? (float) ($lockedVariant->cost_price ?? 0)
                : (float) ($lockedProduct->cost_price ?? 0);
            $beforeInventory = round($beforeQty * $beforeCost, 2);

            $originalQty = abs((int) $movement->quantity_change);
            $unitCost = $this->reversalUnitCost($movement);
            $inventoryDelta = round($originalQty * $unitCost, 2);

            if ($movement->type === 'stock_in') {
                $afterQty = $beforeQty - $originalQty;
                if ($afterQty < 0) {
                    throw ValidationException::withMessages([
                        'movement' => [__('Cannot revoke this stock-in because current stock is lower than the original quantity.')],
                    ]);
                }
                $afterInventory = round(max(0, $beforeInventory - $inventoryDelta), 2);
                $reversalQtyChange = -$originalQty;
            } else {
                $afterQty = $beforeQty + $originalQty;
                $afterInventory = round($beforeInventory + $inventoryDelta, 2);
                $reversalQtyChange = $originalQty;
            }

            $afterCost = $afterQty > 0 ? round($afterInventory / $afterQty, 2) : 0;

            if ($lockedVariant) {
                $lockedVariant->stock = $afterQty;
                $lockedVariant->cost_price = $afterCost;
                $lockedVariant->save();
            } else {
                $lockedProduct->stock = $afterQty;
                $lockedProduct->stock_quantity = $afterQty;
                $lockedProduct->cost_price = $afterCost;
                $lockedProduct->inventory_value = $afterInventory;
                $lockedProduct->save();
            }

            $actorId = $request->user()?->id;
            $reason = trim($validated['reason']);

            $reversal = ProductStockMovement::create([
                'product_id' => $lockedProduct->id,
                'product_variant_id' => $lockedVariant?->id,
                'type' => 'reversal',
                'quantity_before' => $beforeQty,
                'quantity_change' => $reversalQtyChange,
                'quantity_after' => $afterQty,
                'cost_price_before' => $beforeCost,
                'cost_price_after' => $afterCost,
                'inventory_value_before' => $beforeInventory,
                'inventory_value_after' => $afterInventory,
                'input_cost_price_per_unit' => $unitCost,
                'remark' => __('Reversal for stock movement #:id. Reason: :reason', ['id' => $movement->id, 'reason' => $reason]),
                'reversal_of_movement_id' => $movement->id,
                'created_by_user_id' => $actorId,
            ]);

            $movement->forceFill([
                'is_revoked' => true,
                'revoked_at' => now(),
                'revoked_by' => $actorId,
                'revoke_reason' => $reason,
            ])->save();

            return $reversal->load([
                'product:id,name,sku',
                'variant:id,title,sku,is_bundle',
                'createdBy:id,name,email',
                'originalMovement:id,type,quantity_change,created_at',
            ]);
        });

        return $this->respond($result, __('Stock movement revoked successfully. A reversal movement has been created.'));
    }

    private function ensureMovementCanBeRevoked(ProductStockMovement $movement): void
    {
        if ($movement->is_revoked || ProductStockMovement::query()->where('reversal_of_movement_id', $movement->id)->exists()) {
            throw ValidationException::withMessages([
                'movement' => [__('This stock movement has already been revoked.')],
            ]);
        }

        if ($movement->type === 'reversal' || $movement->reversal_of_movement_id) {
            throw ValidationException::withMessages([
                'movement' => [__('Reversal stock movements cannot be revoked again.')],
            ]);
        }

        if (! in_array($movement->type, ['stock_in', 'stock_out'], true)) {
            throw ValidationException::withMessages([
                'movement' => [__('This stock movement type cannot be revoked.')],
            ]);
        }

        if ($movement->type === 'stock_out' && strtolower(trim((string) $movement->remark)) === 'pos checkout') {
            throw ValidationException::withMessages([
                'movement' => [__('POS or order stock deductions cannot be revoked from stock movement logs.')],
            ]);
        }
    }

    private function reversalUnitCost(ProductStockMovement $movement): float
    {
        if ($movement->type === 'stock_in' && $movement->input_cost_price_per_unit !== null) {
            return (float) $movement->input_cost_price_per_unit;
        }

        if ($movement->type === 'stock_out') {
            return (float) $movement->cost_price_before;
        }

        if ($movement->input_cost_price_per_unit !== null) {
            return (float) $movement->input_cost_price_per_unit;
        }

        return (float) $movement->cost_price_after;
    }
}
