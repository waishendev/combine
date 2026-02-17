<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Ecommerce\PosCart;
use App\Models\Ecommerce\PosCartItem;
use App\Models\Ecommerce\ProductVariant;
use App\Services\Ecommerce\OrderPaymentService;
use App\Support\Pricing\ProductPricing;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PosController extends Controller
{
    public function memberSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $builder = Customer::query();

        if ($query !== '') {
            $builder->where(function ($queryBuilder) use ($query) {
                $queryBuilder->where('name', 'like', "%{$query}%")
                    ->orWhere('phone', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%")
                    ->orWhereRaw('CAST(id AS TEXT) = ?', [$query]);
            });
        }

        $paginator = $builder
            ->orderBy('id', 'desc')
            ->paginate($perPage, ['id', 'name', 'phone', 'email'], 'page', $page);

        return $this->respond([
            'data' => collect($paginator->items())->map(fn (Customer $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'phone' => $member->phone,
                'member_code' => (string) $member->id,
                'email' => $member->email,
            ])->values(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function addByBarcode(Request $request)
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string'],
            'qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $variant = ProductVariant::query()
            ->with('product')
            ->where('sku', $validated['barcode'])
            ->where('is_active', true)
            ->first();

        if (! $variant) {
            $variant = ProductVariant::query()
                ->with('product')
                ->where('is_active', true)
                ->whereHas('product', fn ($query) => $query->where('sku', $validated['barcode']))
                ->orderBy('sort_order')
                ->orderBy('id')
                ->first();
        }

        if (!$variant || !$variant->product || !$variant->product->is_active || !$variant->is_active || $variant->product->is_reward_only) {
            return $this->respondError(__('Barcode not found or not sellable.'), 404);
        }

        $qty = (int) ($validated['qty'] ?? 1);

        if ($variant->track_stock && (int) $variant->stock < $qty) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $cart = $this->resolveCart((int) $request->user()->id);

        $pricing = ProductPricing::build($variant->product, $variant);
        $unitPrice = (float) ($pricing['unit_price'] ?? $variant->sale_price ?? $variant->price ?? 0);

        $item = PosCartItem::firstOrNew([
            'pos_cart_id' => $cart->id,
            'variant_id' => $variant->id,
        ]);
        $item->qty = (int) ($item->exists ? $item->qty : 0) + $qty;
        $item->price_snapshot = $unitPrice;

        if ($variant->track_stock && $item->qty > (int) $variant->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load('items.variant.product')),
        ]);
    }

    public function productSearch(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        if ($query === '') {
            return $this->respond([
                'data' => [],
                'current_page' => $page,
                'last_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
            ]);
        }

        $exact = mb_strtolower($query);

        $variants = ProductVariant::query()
            ->with(['product', 'product.images'])
            ->where('is_active', true)
            ->whereHas('product', fn ($builder) => $builder->where('is_active', true)->where('is_reward_only', false))
            ->where(function ($builder) use ($query) {
                $builder->whereRaw('LOWER(sku) = ?', [mb_strtolower($query)])
                    ->orWhere('sku', 'like', "%{$query}%")
                    ->orWhereHas('product', function ($productQuery) use ($query) {
                        $productQuery->whereRaw('LOWER(sku) = ?', [mb_strtolower($query)])
                            ->orWhere('sku', 'like', "%{$query}%")
                            ->orWhere('name', 'like', "%{$query}%");
                    });
            })
            ->orderByRaw('CASE WHEN LOWER(sku) = ? THEN 0 ELSE 1 END', [$exact])
            ->orderByRaw('CASE WHEN EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND LOWER(p.sku) = ?) THEN 0 ELSE 1 END', [$exact])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return $this->respond([
            'data' => collect($variants->items())->map(function (ProductVariant $variant) {
                $product = $variant->product;
                $pricing = ProductPricing::build($product, $variant);

                return [
                    'id' => $variant->id,
                    'name' => $product?->name,
                    'sku' => $variant->sku,
                    'barcode' => $variant->sku,
                    'price' => (float) ($pricing['unit_price'] ?? $variant->sale_price ?? $variant->price ?? 0),
                    'thumbnail_url' => $variant->image_url ?? $product?->cover_image_url,
                ];
            })->values(),
            'current_page' => $variants->currentPage(),
            'last_page' => $variants->lastPage(),
            'per_page' => $variants->perPage(),
            'total' => $variants->total(),
        ]);
    }

    public function updateCartItem(Request $request, int $itemId)
    {
        $validated = $request->validate([
            'qty' => ['required', 'integer', 'min:1'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->with('variant')->findOrFail($itemId);

        if ($item->variant?->track_stock && $validated['qty'] > (int) $item->variant->stock) {
            return $this->respondError(__('Insufficient stock.'), 422);
        }

        $item->qty = $validated['qty'];
        $item->save();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load('items.variant.product')),
        ]);
    }

    public function removeCartItem(Request $request, int $itemId)
    {
        $cart = $this->resolveCart((int) $request->user()->id);
        $item = $cart->items()->findOrFail($itemId);
        $item->delete();

        return $this->respond([
            'cart' => $this->serializeCart($cart->fresh()->load('items.variant.product')),
        ]);
    }

    public function cart(Request $request)
    {
        $cart = $this->resolveCart((int) $request->user()->id)->load('items.variant.product');

        return $this->respond([
            'cart' => $this->serializeCart($cart),
        ]);
    }

    public function checkout(Request $request, OrderPaymentService $orderPaymentService)
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'in:cash,qrpay'],
            'member_id' => ['nullable', 'integer', 'exists:customers,id'],
        ]);

        $cart = $this->resolveCart((int) $request->user()->id)->load('items.variant.product');
        if ($cart->items->isEmpty()) {
            return $this->respondError(__('POS cart is empty.'), 422);
        }

        [$order, $receiptUrl] = DB::transaction(function () use ($validated, $cart, $request, $orderPaymentService) {
            $customerId = $validated['member_id'] ?? null;

            $subtotal = $cart->items->sum(fn (PosCartItem $item) => ((float) $item->price_snapshot) * $item->qty);

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customerId,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $validated['payment_method'],
                'payment_provider' => 'manual',
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $subtotal,
                'pickup_or_shipping' => 'pickup',
                'placed_at' => now(),
                'paid_at' => now(),
                'completed_at' => now(),
                'notes' => 'POS checkout by staff #' . $request->user()->id,
            ]);

            foreach ($cart->items as $item) {
                $variant = $item->variant;
                if (!$variant || !$variant->product) {
                    continue;
                }

                if ($variant->track_stock && $item->qty > (int) $variant->stock) {
                    abort(422, __('Insufficient stock for :sku', ['sku' => $variant->sku ?? $variant->id]));
                }

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'product_name_snapshot' => $variant->product->name,
                    'sku_snapshot' => $variant->product->sku,
                    'variant_name_snapshot' => $variant->title,
                    'variant_sku_snapshot' => $variant->sku,
                    'price_snapshot' => $item->price_snapshot,
                    'variant_price_snapshot' => $variant->price,
                    'variant_cost_snapshot' => $variant->cost_price,
                    'quantity' => $item->qty,
                    'line_total' => ((float) $item->price_snapshot) * $item->qty,
                    'locked' => true,
                ]);
            }

            $order->load(['items', 'customer']);
            $orderPaymentService->handlePaid($order);

            $receiptUrl = null;
            if (!$customerId) {
                $token = Str::random(64);
                OrderReceiptToken::create([
                    'order_id' => $order->id,
                    'token' => $token,
                    'expires_at' => null,
                ]);
                $frontendOrigin = $request->headers->get('origin') ?: config('services.frontend_url', config('app.url'));
                $frontendUrl = rtrim((string) $frontendOrigin, '/');
                $receiptUrl = $frontendUrl . '/receipt/' . $token;
            }

            $cart->items()->delete();

            return [$order, $receiptUrl];
        });

        return $this->respond([
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'grand_total' => $order->grand_total,
                'payment_method' => $order->payment_method,
            ],
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'receipt_public_url' => $receiptUrl,
        ]);
    }

    protected function resolveCart(int $staffUserId): PosCart
    {
        return PosCart::firstOrCreate([
            'staff_user_id' => $staffUserId,
        ]);
    }

    protected function serializeCart(PosCart $cart): array
    {
        $items = $cart->items->map(function (PosCartItem $item) {
            $variant = $item->variant;
            return [
                'id' => $item->id,
                'qty' => $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $item->price_snapshot * $item->qty,
                'variant_id' => $variant?->id,
                'variant_name' => $variant?->title,
                'variant_sku' => $variant?->sku,
                'product_name' => $variant?->product?->name,
            ];
        })->values();

        return [
            'id' => $cart->id,
            'items' => $items,
            'subtotal' => $items->sum('line_total'),
            'grand_total' => $items->sum('line_total'),
        ];
    }

    protected function generateOrderNumber(): string
    {
        return 'POS-' . Carbon::now()->format('YmdHis') . '-' . str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }
}
