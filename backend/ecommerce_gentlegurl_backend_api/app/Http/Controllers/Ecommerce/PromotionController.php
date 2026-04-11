<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Product;
use App\Models\Promotion;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    public function index(Request $request)
    {
        $query = Promotion::query()->with(['promotionProducts.product:id,name', 'promotionTiers']);

        if ($request->filled('is_active')) {
            $query->where('is_active', (bool) $request->boolean('is_active'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            if ($search !== '') {
                $query->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', '%' . $search . '%')
                        ->orWhere('title', 'like', '%' . $search . '%');
                });
            }
        }

        $promotions = $query
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->paginate((int) $request->get('per_page', 20));

        return $this->respond($promotions);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $promotion = null;
        $resolvedType = (string) ($data['type'] ?? 'pos_group');

        \DB::transaction(function () use (&$promotion, $data, $resolvedType) {
            $promotion = Promotion::create([
                'type' => $resolvedType,
                'content_html' => (string) ($data['content_html'] ?? ''),
                'display_position' => (string) ($data['display_position'] ?? 'pos'),
                'name' => $data['name'],
                'title' => $data['name'],
                'code' => $data['code'] ?? null,
                'description' => $data['description'] ?? null,
                'is_active' => (bool) ($data['is_active'] ?? true),
                'trigger_type' => $data['trigger_type'],
                'priority' => (int) ($data['priority'] ?? 0),
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
            ]);

            $this->syncProductsAndTiers($promotion, $data);
        });

        return $this->respond($promotion->load(['promotionProducts.product:id,name', 'promotionTiers']), __('Promotion created successfully.'), true, 201);
    }

    public function show(Promotion $promotion)
    {
        return $this->respond($promotion->load(['promotionProducts.product:id,name,is_active', 'promotionTiers']));
    }

    public function update(Request $request, Promotion $promotion)
    {
        $data = $this->validatePayload($request, $promotion->id);

        $resolvedType = (string) ($data['type'] ?? ($promotion->type ?? 'pos_group'));

        \DB::transaction(function () use ($promotion, $data, $resolvedType) {
            $promotion->update([
                'type' => $resolvedType,
                'content_html' => (string) ($data['content_html'] ?? ($promotion->content_html ?? '')),
                'display_position' => (string) ($data['display_position'] ?? ($promotion->display_position ?? 'pos')),
                'name' => $data['name'],
                'title' => $data['name'],
                'code' => $data['code'] ?? null,
                'description' => $data['description'] ?? null,
                'is_active' => (bool) ($data['is_active'] ?? true),
                'trigger_type' => $data['trigger_type'],
                'priority' => (int) ($data['priority'] ?? 0),
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
            ]);

            $this->syncProductsAndTiers($promotion, $data);
        });

        return $this->respond($promotion->load(['promotionProducts.product:id,name', 'promotionTiers']), __('Promotion updated successfully.'));
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();

        return $this->respond(null, __('Promotion deleted successfully.'));
    }

    public function productOptions(Request $request)
    {
        $editingPromotionId = $request->query('editing_promotion_id');

        $productPromotionMap = \DB::table('promotion_products as pp')
            ->join('promotions as p', 'p.id', '=', 'pp.promotion_id')
            ->select('pp.product_id', 'pp.promotion_id', 'p.name', 'p.title')
            ->get()
            ->keyBy('product_id');

        $products = Product::query()
            ->where('is_active', true)
            ->with(['images' => function ($query) {
                $query->where('type', 'image')
                    ->orderBy('sort_order')
                    ->orderBy('id');
            }])
            ->orderBy('name')
            ->get(['id', 'name']);

        $data = $products->map(function (Product $product) use ($productPromotionMap, $editingPromotionId) {
            $used = $productPromotionMap->get($product->id);
            $usedByOther = $used && (int) $used->promotion_id !== (int) $editingPromotionId;
            $promotionName = $used ? ($used->name ?: $used->title) : null;

            $cover = $product->images->first();
            $coverUrl = null;
            if ($cover) {
                $coverUrl = $cover->thumbnail_url ?: $cover->url;
            }

            return [
                'id' => $product->id,
                'name' => $product->name,
                'cover_image_url' => $coverUrl,
                'disabled' => $usedByOther,
                'disabled_reason' => $usedByOther ? 'Already used in Promotion ' . $promotionName : null,
                'promotion_id' => $used ? (int) $used->promotion_id : null,
                'promotion_name' => $promotionName,
            ];
        })->values();

        return $this->respond(['data' => $data]);
    }

    protected function validatePayload(Request $request, ?int $promotionId = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['nullable', 'string', 'max:30'],
            'content_html' => ['nullable', 'string'],
            'display_position' => ['nullable', 'string', 'max:50'],
            'is_active' => ['boolean'],
            'trigger_type' => ['required', Rule::in(['quantity', 'amount'])],
            'priority' => ['nullable', 'integer'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'tiers' => ['required', 'array', 'min:1'],
            'tiers.*.min_qty' => ['nullable', 'integer', 'min:1'],
            'tiers.*.min_amount' => ['nullable', 'numeric', 'gt:0'],
            'tiers.*.discount_type' => ['required', Rule::in(['bundle_fixed_price', 'percentage_discount', 'fixed_discount'])],
            'tiers.*.discount_value' => ['required', 'numeric', 'gt:0'],
        ]);

        $productIds = array_values(array_unique(array_map('intval', $data['product_ids'])));

        $conflictQuery = \DB::table('promotion_products')
            ->whereIn('product_id', $productIds);
        if ($promotionId) {
            $conflictQuery->where('promotion_id', '!=', $promotionId);
        }
        $conflict = $conflictQuery->exists();
        if ($conflict) {
            abort(response()->json([
                'message' => 'Some selected products already belong to another promotion.',
            ], 422));
        }

        $triggerType = $data['trigger_type'];
        $seenThresholds = [];
        foreach ($data['tiers'] as $index => $tier) {
            if ($triggerType === 'quantity' && empty($tier['min_qty'])) {
                abort(response()->json(['message' => "Tier #" . ($index + 1) . " requires min_qty for quantity trigger."], 422));
            }
            if ($triggerType === 'amount' && empty($tier['min_amount'])) {
                abort(response()->json(['message' => "Tier #" . ($index + 1) . " requires min_amount for amount trigger."], 422));
            }

            $key = $triggerType === 'quantity' ? 'qty_' . (int) ($tier['min_qty'] ?? 0) : 'amt_' . number_format((float) ($tier['min_amount'] ?? 0), 2, '.', '');
            if (isset($seenThresholds[$key])) {
                abort(response()->json(['message' => 'Tier trigger values must be unique per promotion.'], 422));
            }
            $seenThresholds[$key] = true;
        }

        $data['product_ids'] = $productIds;

        return $data;
    }

    protected function syncProductsAndTiers(Promotion $promotion, array $data): void
    {
        $promotion->promotionProducts()->delete();
        foreach ($data['product_ids'] as $productId) {
            $promotion->promotionProducts()->create(['product_id' => $productId]);
        }

        $promotion->promotionTiers()->delete();
        foreach ($data['tiers'] as $tier) {
            $promotion->promotionTiers()->create([
                'min_qty' => $tier['min_qty'] ?? null,
                'min_amount' => $tier['min_amount'] ?? null,
                'discount_type' => $tier['discount_type'],
                'discount_value' => $tier['discount_value'],
            ]);
        }
    }
}
