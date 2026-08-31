<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\PosPaymentMethod;
use App\Services\PosPaymentMethodService;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PosPaymentMethodController extends Controller
{
    public function __construct(private StoreLocationAccessService $access, private PosPaymentMethodService $methods) {}

    public function show(Request $request)
    {
        $validated = $request->validate(['store_location_id' => ['required', 'integer', 'exists:store_locations,id']]);
        $branch = $this->access->authorizeStoreLocation($request->user(), (int) $validated['store_location_id']);
        return response()->json(['data' => $this->methods->configuration((int) $branch->id)]);
    }

    public function update(Request $request)
    {
        $keys = PosPaymentMethod::query()->pluck('key')->all();
        $validated = $request->validate([
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'methods' => ['required', 'array', 'size:' . count($keys)],
            'methods.*.key' => ['required', 'distinct', Rule::in($keys)],
            'methods.*.is_enabled' => ['required', 'boolean'],
            'methods.*.sort_order' => ['required', 'integer', 'min:0', 'max:999'],
        ]);
        $branch = $this->access->authorizeStoreLocation($request->user(), (int) $validated['store_location_id']);
        DB::transaction(function () use ($validated, $branch) {
            $definitions = PosPaymentMethod::query()->pluck('id', 'key');
            foreach ($validated['methods'] as $row) {
                DB::table('store_location_pos_payment_methods')->updateOrInsert(
                    ['store_location_id' => $branch->id, 'pos_payment_method_id' => $definitions[$row['key']]],
                    ['is_enabled' => $row['is_enabled'], 'sort_order' => $row['sort_order'], 'updated_at' => now(), 'created_at' => now()]
                );
            }
        });
        return response()->json(['data' => $this->methods->configuration((int) $branch->id)]);
    }
}
