<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Voucher;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VoucherController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $vouchers = Voucher::query()
            ->when($request->filled('code'), fn($q) => $q->where('code', 'like', '%' . $request->string('code')->toString() . '%'))
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('is_reward_only'), fn($q) => $q->where('is_reward_only', $request->boolean('is_reward_only')))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return $this->respond($vouchers);
    }

    public function show(Voucher $voucher)
    {
        $voucher->load([
            'products:id,name,sku',
            'categories:id,name',
        ]);

        return $this->respond($voucher);
    }

    public function assignable(Request $request)
    {
        $now = Carbon::now();
        $status = $request->string('status')->toString();
        $search = $request->string('search')->toString();

        $vouchers = Voucher::query()
            ->when($search, fn($q) => $q->where('code', 'like', '%' . $search . '%'))
            ->when($status === 'active' || $status === '', function ($q) use ($now) {
                $q->where('is_active', true)
                    ->where(function ($query) use ($now) {
                        $query->whereNull('end_at')
                            ->orWhere('end_at', '>=', $now);
                    });
            })
            ->orderByDesc('created_at')
            ->get();

        return $this->respond($vouchers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:100', 'unique:vouchers,code'],
            'type' => ['required', Rule::in(['fixed', 'percent'])],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'scope_type' => ['nullable', Rule::in(['all', 'products', 'categories'])],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit_total' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_customer' => ['nullable', 'integer', 'min:1'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_customer' => ['nullable', 'integer', 'min:1'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['sometimes', 'boolean'],
            'is_reward_only' => ['sometimes', 'boolean'],
            'product_ids' => ['array'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'category_ids' => ['array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        $payload = $validated + [
            'is_active' => $validated['is_active'] ?? true,
            'is_reward_only' => $validated['is_reward_only'] ?? false,
            'scope_type' => $validated['scope_type'] ?? 'all',
        ];
        $payload['usage_limit_total'] = $validated['usage_limit_total'] ?? $validated['max_uses'] ?? null;
        $payload['usage_limit_per_customer'] = $validated['usage_limit_per_customer'] ?? $validated['max_uses_per_customer'] ?? null;

        $voucher = DB::transaction(function () use ($payload, $validated) {
            $voucher = Voucher::create($payload);

            $this->syncVoucherScopeRelations($voucher, $validated);

            return $voucher;
        });

        $voucher->load(['products:id,name,sku', 'categories:id,name']);

        return $this->respond($voucher, __('Voucher created.'));
    }

    public function update(Request $request, Voucher $voucher)
    {
        $validated = $request->validate([
            'code' => ['sometimes', 'string', 'max:100', Rule::unique('vouchers', 'code')->ignore($voucher->id)],
            'type' => ['sometimes', Rule::in(['fixed', 'percent'])],
            'value' => ['nullable', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'scope_type' => ['nullable', Rule::in(['all', 'products', 'categories'])],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit_total' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_customer' => ['nullable', 'integer', 'min:1'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_customer' => ['nullable', 'integer', 'min:1'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['sometimes', 'boolean'],
            'is_reward_only' => ['sometimes', 'boolean'],
            'product_ids' => ['array'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'category_ids' => ['array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        $payload = $validated;

        if (array_key_exists('usage_limit_total', $validated) || array_key_exists('max_uses', $validated)) {
            $payload['usage_limit_total'] = $validated['usage_limit_total'] ?? $validated['max_uses'];
        }

        if (array_key_exists('usage_limit_per_customer', $validated) || array_key_exists('max_uses_per_customer', $validated)) {
            $payload['usage_limit_per_customer'] = $validated['usage_limit_per_customer'] ?? $validated['max_uses_per_customer'];
        }

        $voucher = DB::transaction(function () use ($voucher, $payload, $validated) {
            $voucher->fill($payload);
            $voucher->save();

            $this->syncVoucherScopeRelations($voucher, $validated);

            return $voucher;
        });

        $voucher->load(['products:id,name,sku', 'categories:id,name']);

        return $this->respond($voucher, __('Voucher updated.'));
    }

    public function destroy(Voucher $voucher)
    {
        $voucher->delete();

        return $this->respond(null, __('Voucher deleted successfully.'));
    }

    protected function syncVoucherScopeRelations(Voucher $voucher, array $validated): void
    {
        $scopeType = $validated['scope_type'] ?? $voucher->scope_type ?? 'all';
        $productIds = $validated['product_ids'] ?? [];
        $categoryIds = $validated['category_ids'] ?? [];

        if ($scopeType === 'products' && empty($productIds)) {
            throw ValidationException::withMessages([
                'product_ids' => __('Please select at least one product.'),
            ])->status(422);
        }

        if ($scopeType === 'categories' && empty($categoryIds)) {
            throw ValidationException::withMessages([
                'category_ids' => __('Please select at least one category.'),
            ])->status(422);
        }

        if ($scopeType === 'products') {
            $voucher->products()->sync($productIds);
            $voucher->categories()->sync([]);
            return;
        }

        if ($scopeType === 'categories') {
            $voucher->categories()->sync($categoryIds);
            $voucher->products()->sync([]);
            return;
        }

        $voucher->products()->sync([]);
        $voucher->categories()->sync([]);
    }
}
