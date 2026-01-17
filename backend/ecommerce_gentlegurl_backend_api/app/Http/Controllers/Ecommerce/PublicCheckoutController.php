<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderUpload;
use App\Models\Ecommerce\OrderVoucher;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use App\Models\Ecommerce\Cart;
use App\Services\BillplzService;
use App\Services\Ecommerce\CartService;
use App\Services\Ecommerce\ShippingService;
use App\Models\BankAccount;
use App\Models\Setting;
use App\Models\BillplzBill;
use App\Services\Voucher\VoucherService;
use App\Services\Ecommerce\OrderReserveService;
use Carbon\Carbon;
use App\Support\Pricing\ProductPricing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class PublicCheckoutController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(
        protected VoucherService $voucherService,
        protected BillplzService $billplzService,
        protected CartService $cartService,
        protected OrderReserveService $orderReserveService,
        protected ShippingService $shippingService,
    )
    {
    }

    public function preview(Request $request)
    {
        $validated = $this->validateOrderRequest($request, false, false);
        $customer = $this->currentCustomer();
        $shippingMethod = $this->normalizeShippingMethod($validated['shipping_method'] ?? 'pickup');
        $itemsInput = $validated['items'] ?? [];
        $hasItemsInput = !empty($itemsInput);
        $cart = $hasItemsInput ? null : $this->resolveCart($customer, $validated['session_token'] ?? null);
        $cartHasItems = $cart && $cart->items()->count() > 0;

        if (!$cartHasItems && !$hasItemsInput) {
            return $this->respondError(__('Cart is empty.'), 422);
        }

        $calculation = $this->calculateTotals(
            $cartHasItems ? $cart : null,
            $itemsInput,
            $customer,
            $shippingMethod,
            $validated['voucher_code'] ?? null,
            $validated['customer_voucher_id'] ?? null,
            $validated['shipping_country'] ?? null,
            $validated['shipping_state'] ?? null,
            true,
        );

        $this->orderReserveService->validateStockForItems($calculation['items']);

        return $this->respond([
            'items' => $calculation['items'],
            'subtotal' => $calculation['subtotal'],
            'discount_total' => $calculation['discount_total'],
            'shipping_fee' => $calculation['shipping_fee'],
            'grand_total' => $calculation['grand_total'],
            'voucher' => $calculation['voucher'],
            'voucher_error' => $calculation['voucher_error'],
            'voucher_valid' => $calculation['voucher_valid'],
            'voucher_message' => $calculation['voucher_error'],
            'shipping' => $calculation['shipping'] ?? null,
        ]);
    }

    public function createOrder(Request $request)
    {
        // Example manual transfer payload:
        // {
        //     "items": [{"product_id": 1, "quantity": 2}],
        //     "payment_method": "manual_transfer",
        //     "bank_account_id": 3,
        //     "shipping_method": "pickup",
        //     "shipping_name": "John Doe",
        //     "shipping_phone": "0123456789",
        //     "shipping_address_line1": "123 Street",
        //     "shipping_city": "City",
        //     "shipping_state": "State",
        //     "shipping_country": "Country",
        //     "shipping_postcode": "12345"
        // }
        $validated = $this->validateOrderRequest($request, true);

        $customer = $this->currentCustomer();

        $shippingMethod = $this->normalizeShippingMethod($validated['shipping_method']);
        $itemsInput = $validated['items'] ?? [];
        $hasItemsInput = !empty($itemsInput);
        $cart = $hasItemsInput ? null : $this->resolveCart($customer, $validated['session_token'] ?? null);
        $cartHasItems = $cart && $cart->items()->count() > 0;

        if (!$cartHasItems && !$hasItemsInput) {
            return $this->respondError(__('Cart is empty.'), 422);
        }

        $calculation = $this->calculateTotals(
            $cartHasItems ? $cart : null,
            $itemsInput,
            $customer,
            $shippingMethod,
            $validated['voucher_code'] ?? null,
            $validated['customer_voucher_id'] ?? null,
            $validated['shipping_country'] ?? null,
            $validated['shipping_state'] ?? null,
        );

        if ((!empty($validated['voucher_code']) || !empty($validated['customer_voucher_id'])) && (!$calculation['voucher_result'] || !$calculation['voucher_result']->valid)) {
            return $this->respond(null, $calculation['voucher_error'] ?? __('Invalid voucher'), false, 422);
        }

        $bankAccount = null;
        if (($validated['payment_method'] ?? 'manual_transfer') === 'manual_transfer' && empty($validated['bank_account_id'])) {
            return $this->respondError(__('bank_account_id is required for manual transfer.'), 422);
        }

        if (!empty($validated['bank_account_id'])) {
            $bankAccount = BankAccount::where('is_active', true)
                ->find($validated['bank_account_id']);

            if (!$bankAccount) {
                return $this->respondError(__('Selected bank account is not available.'), 422);
            }
        }

        if (!$customer && !empty($validated['customer'])) {
            $customer = Customer::firstOrCreate(
                ['email' => $validated['customer']['email']],
                [
                    'name' => $validated['customer']['name'],
                    'phone' => $validated['customer']['phone'] ?? null,
                    'password' => bcrypt(str()->random(10)),
                    'is_active' => true,
                ]
            );
        }

        $paymentMethod = $validated['payment_method'] ?? 'manual_transfer';
        $shippingName = $validated['shipping_name'] ?? data_get($validated, 'customer.name') ?? $customer?->name;
        $shippingPhone = $validated['shipping_phone'] ?? data_get($validated, 'customer.phone') ?? $customer?->phone;
        $shippingAddressLine1 = $validated['shipping_address_line1'] ?? ($validated['shipping_address'] ?? null);
        $billingSameAsShipping = filter_var(
            $validated['billing_same_as_shipping'] ?? true,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );
        $billingSameAsShipping = $billingSameAsShipping ?? true;

        if ($billingSameAsShipping) {
            $billingName = $shippingName;
            $billingPhone = $shippingPhone;
            $billingAddressLine1 = $shippingAddressLine1;
            $billingAddressLine2 = $validated['shipping_address_line2'] ?? null;
            $billingCity = $validated['shipping_city'] ?? null;
            $billingState = $validated['shipping_state'] ?? null;
            $billingPostcode = $validated['shipping_postcode'] ?? null;
            $billingCountry = $validated['shipping_country'] ?? 'MY';
        } else {
            $billingName = $validated['billing_name'] ?? null;
            $billingPhone = $validated['billing_phone'] ?? null;
            $billingAddressLine1 = $validated['billing_address_line1'] ?? null;
            $billingAddressLine2 = $validated['billing_address_line2'] ?? null;
            $billingCity = $validated['billing_city'] ?? null;
            $billingState = $validated['billing_state'] ?? null;
            $billingPostcode = $validated['billing_postcode'] ?? null;
            $billingCountry = $validated['billing_country'] ?? 'MY';
        }

        $paymentProvider = str_starts_with($paymentMethod, 'billplz_') ? 'billplz' : 'manual';
        $billplzUrl = null;
        $billplzId = null;

        try {
            [$order, $billplzUrl, $billplzId] = DB::transaction(function () use ($validated, $customer, $calculation, $paymentMethod, $paymentProvider, $shippingAddressLine1, $shippingName, $shippingPhone, $bankAccount, $shippingMethod, $billingSameAsShipping, $billingName, $billingPhone, $billingAddressLine1, $billingAddressLine2, $billingCity, $billingState, $billingPostcode, $billingCountry) {
                $this->orderReserveService->reserveStockForItems($calculation['items']);

                $order = Order::create([
                    'order_number' => $this->generateOrderNumber(),
                    'customer_id' => $customer?->id,
                    'status' => 'pending',
                    'payment_status' => 'unpaid',
                    'payment_method' => $paymentMethod,
                    'payment_provider' => $paymentProvider,
                    'payment_gateway_id' => null,
                    'bank_account_id' => $bankAccount?->id,
                    'pickup_or_shipping' => $shippingMethod,
                    'pickup_store_id' => $validated['store_location_id'] ?? null,
                    'subtotal' => $calculation['subtotal'],
                    'discount_total' => $calculation['discount_total'],
                    'shipping_fee' => $calculation['shipping_fee'],
                    'grand_total' => $calculation['grand_total'],
                    'voucher_code_snapshot' => $calculation['voucher']['code'] ?? ($validated['voucher_code'] ?? null),
                    'placed_at' => Carbon::now(),
                    'shipping_name' => $shippingName,
                    'shipping_phone' => $shippingPhone,
                    'shipping_address_line1' => $shippingAddressLine1,
                    'shipping_address_line2' => $validated['shipping_address_line2'] ?? null,
                    'shipping_city' => $validated['shipping_city'] ?? null,
                    'shipping_state' => $validated['shipping_state'] ?? null,
                    'shipping_country' => $validated['shipping_country'] ?? null,
                    'shipping_postcode' => $validated['shipping_postcode'] ?? null,
                    'billing_same_as_shipping' => $billingSameAsShipping,
                    'billing_name' => $billingName,
                    'billing_phone' => $billingPhone,
                    'billing_address_line1' => $billingAddressLine1,
                    'billing_address_line2' => $billingAddressLine2,
                    'billing_city' => $billingCity,
                    'billing_state' => $billingState,
                    'billing_postcode' => $billingPostcode,
                    'billing_country' => $billingCountry,
                ]);

                if ($customer) {
                    $order->setRelation('customer', $customer);
                }

                foreach ($calculation['items'] as $item) {
                    $orderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $item['product_id'],
                        'product_variant_id' => $item['product_variant_id'] ?? null,
                        'product_name_snapshot' => $item['name'],
                        'sku_snapshot' => $item['sku'] ?? null,
                        'variant_name_snapshot' => $item['variant_name'] ?? null,
                        'variant_sku_snapshot' => $item['variant_sku'] ?? null,
                        'price_snapshot' => $item['unit_price'],
                        'variant_price_snapshot' => $item['variant_price'] ?? null,
                        'variant_cost_snapshot' => $item['variant_cost'] ?? null,
                        'quantity' => $item['quantity'],
                        'line_total' => $item['line_total'],
                        'is_reward' => $item['is_reward'] ?? false,
                        'reward_redemption_id' => $item['reward_redemption_id'] ?? null,
                        'locked' => $item['locked'] ?? false,
                    ]);

                    if (!empty($item['reward_redemption_id'])) {
                        $redemption = $item['reward_redemption_id']
                            ? $customer?->loyaltyRedemptions()->where('id', $item['reward_redemption_id'])->first()
                            : null;

                        if ($redemption) {
                            $meta = $redemption->meta ?? [];
                            $meta['order_id'] = $order->id;
                            $meta['order_item_id'] = $orderItem->id;
                            $redemption->meta = $meta;
                            $redemption->status = 'completed';
                            $redemption->save();
                        }
                    }
                }

                if (!empty($calculation['voucher']) && $calculation['voucher']['discount_amount'] > 0) {
                    $voucher = $calculation['voucher'];
                    OrderVoucher::create([
                        'order_id' => $order->id,
                        'voucher_id' => $voucher['id'] ?? null,
                        'customer_voucher_id' => $voucher['customer_voucher_id'] ?? null,
                        'code_snapshot' => $voucher['code'],
                        'discount_amount' => $voucher['discount_amount'],
                    ]);

                    if (!empty($voucher['id'])) {
                        $this->voucherService->recordUsage(
                            $voucher['id'],
                            $customer?->id,
                            $order->id,
                            $voucher['customer_voucher_id'] ?? null,
                            $voucher['discount_amount'] ?? null,
                        );
                    }
                }

                $this->removeOrderedCartItems($customer, $validated['session_token'] ?? null, $calculation['items']);

                $billplzUrl = null;
                $billplzId = null;

                if ($paymentProvider === 'billplz') {
                    $billResponse = $this->billplzService->createBill($order);
                    $billplzId = data_get($billResponse, 'id');
                    $billplzUrl = data_get($billResponse, 'url');

                    if (!$billplzId || !$billplzUrl) {
                        throw new RuntimeException('Invalid Billplz response.');
                    }

                    $order->payment_reference = $billplzId;
                    $order->payment_url = $billplzUrl;
                    $order->payment_meta = [
                        'provider' => 'billplz',
                        'bill_id' => $billplzId,
                        'collection_id' => data_get($billResponse, 'collection_id'),
                        'state' => data_get($billResponse, 'state'),
                        'reference_1' => data_get($billResponse, 'reference_1'),
                    ];
                    $order->save();

                    BillplzBill::updateOrCreate(
                        ['billplz_id' => $billplzId],
                        [
                            'order_id' => $order->id,
                            'collection_id' => data_get($billResponse, 'collection_id'),
                            'state' => data_get($billResponse, 'state'),
                            'paid' => false,
                            'amount' => data_get($billResponse, 'amount'),
                            'payload' => $billResponse,
                        ]
                    );
                }

                return [$order, $billplzUrl, $billplzId];
            });
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            Log::error('Failed to create order', [
                'error' => $exception->getMessage(),
                'payment_method' => $paymentMethod,
            ]);

            $status = $exception instanceof RuntimeException ? 422 : 500;
            $message = $exception instanceof RuntimeException
                ? $exception->getMessage()
                : __('Unable to create order, please try again later.');

            return $this->respondError($message, $status);
        }

        return $this->respond([
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'grand_total' => $order->grand_total,
            'payment_status' => $order->payment_status,
            'status' => $order->status,
            'payment_method' => $paymentMethod,
            'payment_provider' => $paymentProvider,
            'payment_reference' => $billplzId,
            'payment_url' => $billplzUrl,
            'payment' => [
                'provider' => $paymentProvider,
                'billplz_id' => $billplzId,
                'billplz_url' => $billplzUrl,
            ],
            'bank_account' => $bankAccount ? [
                'id' => $bankAccount->id,
                'bank_name' => $bankAccount->bank_name,
                'account_name' => $bankAccount->account_name,
                'account_number' => $bankAccount->account_number,
                'account_no' => $bankAccount->account_number,
                'branch' => $bankAccount->branch,
                'logo_url' => $bankAccount->logo_url,
                'qr_image_url' => $bankAccount->qr_image_url,
                'label' => $bankAccount->label,
                'swift_code' => $bankAccount->swift_code,
                'instructions' => $bankAccount->instructions,
            ] : null,
            'voucher' => $calculation['voucher_result'] && $calculation['voucher_result']->valid ? [
                'code' => $calculation['voucher']['code'] ?? null,
                'discount_amount' => $calculation['voucher']['discount_amount'] ?? 0,
            ] : null,
        ]);
    }

    public function lookup(Request $request)
    {
        $validated = $request->validate([
            'order_no' => ['required', 'string'],
            'order_id' => ['nullable', 'integer'],
        ]);

        $orderQuery = Order::with(['bankAccount', 'uploads', 'pickupStore'])
            ->where('order_number', $validated['order_no']);

        if (!empty($validated['order_id'])) {
            $orderQuery->where('id', $validated['order_id']);
        }

        $order = $orderQuery->first();

        if (!$order) {
            return $this->respondError(__('Order not found.'), 404);
        }

        $bankAccount = $order->bankAccount ? [
            'id' => $order->bankAccount->id,
            'bank_name' => $order->bankAccount->bank_name,
            'account_name' => $order->bankAccount->account_name,
            'account_number' => $order->bankAccount->account_number,
            'account_no' => $order->bankAccount->account_number,
            'branch' => $order->bankAccount->branch,
            'logo_url' => $order->bankAccount->logo_url,
            'qr_image_url' => $order->bankAccount->qr_image_url,
            'label' => $order->bankAccount->label,
            'swift_code' => $order->bankAccount->swift_code,
            'instructions' => $order->bankAccount->instructions,
        ] : null;

        $uploads = $order->uploads
            ->where('type', 'payment_slip')
            ->values()
            ->map(fn($upload) => [
                'id' => $upload->id,
                'file_url' => $upload->file_url,
                'note' => $upload->note,
                'status' => $upload->status,
                'created_at' => $upload->created_at?->toDateTimeString(),
            ]);

        return $this->respond([
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'grand_total' => $order->grand_total,
            'payment_method' => $order->payment_method,
            'payment_provider' => $order->payment_provider,
            'payment_reference' => $order->payment_reference,
            'payment_url' => $order->payment_url,
            'payment_status' => $order->payment_status,
            'status' => $order->status,
            'bank_account' => $bankAccount,
            'pickup_store' => $order->pickupStore ? [
                'id' => $order->pickupStore->id,
                'name' => $order->pickupStore->name,
                'address_line1' => $order->pickupStore->address_line1,
                'address_line2' => $order->pickupStore->address_line2,
                'city' => $order->pickupStore->city,
                'state' => $order->pickupStore->state,
                'postcode' => $order->pickupStore->postcode,
                'country' => $order->pickupStore->country,
                'phone' => $order->pickupStore->phone,
            ] : null,
            'uploads' => $uploads,
        ]);
    }

    public function uploadSlip(Request $request, Order $order)
    {
        if ($order->payment_method !== 'manual_transfer') {
            return $this->respondError(__('Order does not support manual transfer uploads.'), 422);
        }

        if ($order->payment_status === 'paid' || in_array($order->status, ['cancelled', 'completed'], true)) {
            return $this->respondError(__('Payment slip upload is no longer allowed.'), 422);
        }

        if (!in_array($order->status, ['pending', 'processing'], true)) {
            return $this->respondError(__('Order is not eligible for slip upload.'), 422);
        }

        $validated = $request->validate([
            'slip' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'note' => ['nullable', 'string'],
        ]);

        $filePath = $request->file('slip')->store('order-slips', 'public');

        $result = DB::transaction(function () use ($order, $filePath, $validated) {
            $existingSlips = $order->uploads()
                ->where('type', 'payment_slip')
                ->lockForUpdate()
                ->get();
            $pathsToDelete = [];

            $primarySlip = $existingSlips->first();
            if ($primarySlip) {
                if ($primarySlip->file_path) {
                    $pathsToDelete[] = $primarySlip->file_path;
                }

                $primarySlip->fill([
                    'file_path' => $filePath,
                    'note' => $validated['note'] ?? null,
                    'status' => 'pending',
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                ]);
                $primarySlip->save();
            } else {
                $primarySlip = OrderUpload::create([
                    'order_id' => $order->id,
                    'type' => 'payment_slip',
                    'file_path' => $filePath,
                    'note' => $validated['note'] ?? null,
                    'status' => 'pending',
                ]);
            }

            $existingSlips->skip(1)->each(function (OrderUpload $slip) use (&$pathsToDelete) {
                if ($slip->file_path) {
                    $pathsToDelete[] = $slip->file_path;
                }
                $slip->delete();
            });

            if ($order->status === 'pending') {
                $order->status = 'processing';
                $order->save();
            }

            return [
                'upload' => $primarySlip->fresh(),
                'paths' => $pathsToDelete,
                'status' => $order->status,
            ];
        });

        foreach (array_unique($result['paths']) as $path) {
            Storage::disk('public')->delete($path);
        }

        $upload = $result['upload'];

        return $this->respond([
            'upload' => [
                'id' => $upload->id,
                'file_url' => $upload->file_url,
                'note' => $upload->note,
                'status' => $upload->status,
                'created_at' => $upload->created_at,
            ],
            'latest_slip_url' => $upload->file_url,
            'status' => $result['status'] === 'processing' ? 'processing' : 'pending verification',
        ], __('Payment slip uploaded.'));
    }

    protected function validateOrderRequest(Request $request, bool $requirePaymentMethod = false, bool $requireBillingFields = true): array
    {
        return $request->validate([
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.is_reward' => ['sometimes', 'boolean'],
            'items.*.reward_redemption_id' => ['nullable', 'integer', 'exists:loyalty_redemptions,id'],
            'voucher_code' => ['nullable', 'string'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id'],
            'shipping_method' => ['required', 'in:pickup,shipping,self_pickup'],
            'store_location_id' => ['required_unless:shipping_method,shipping', 'integer'],
            'shipping_postcode' => ['nullable', 'string'],
            'customer' => ['nullable', 'array'],
            'customer.name' => ['required_with:customer', 'string'],
            'customer.email' => ['required_with:customer', 'email'],
            'customer.phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'shipping_name' => [
                'nullable',
                'string',
                Rule::requiredIf(fn() => ($request->input('shipping_method') === 'self_pickup') || str_starts_with((string) $request->input('payment_method'), 'billplz_')),
            ],
            'shipping_phone' => [
                'nullable',
                'string',
                Rule::requiredIf(fn() => ($request->input('shipping_method') === 'self_pickup') || str_starts_with((string) $request->input('payment_method'), 'billplz_')),
            ],
            'shipping_address_line1' => ['nullable', 'string'],
            'shipping_address_line2' => ['nullable', 'string'],
            'shipping_city' => ['nullable', 'string'],
            'shipping_state' => ['nullable', 'string'],
            'shipping_country' => ['nullable', 'string'],
            'billing_same_as_shipping' => ['nullable', 'boolean'],
            'billing_name' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_phone' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_address_line1' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_address_line2' => ['nullable', 'string'],
            'billing_city' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_state' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_postcode' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'billing_country' => [
                Rule::requiredIf(fn() => $requireBillingFields && $request->boolean('billing_same_as_shipping') === false),
                'nullable',
                'string',
            ],
            'session_token' => ['nullable', 'string', 'max:100'],
            'payment_method' => [$requirePaymentMethod ? 'required' : 'nullable', 'string', 'in:manual_transfer,billplz_fpx,billplz_card'],
            'bank_account_id' => [
                $requirePaymentMethod ? 'required_if:payment_method,manual_transfer' : 'nullable',
                'nullable',
                'integer',
                'exists:bank_accounts,id',
            ],
        ]);
    }

    protected function normalizeShippingMethod(string $shippingMethod): string
    {
        return $shippingMethod === 'self_pickup' ? 'pickup' : $shippingMethod;
    }

    protected function resolveCart(?Customer $customer, ?string $sessionToken): ?Cart
    {
        if ($customer?->id) {
            return Cart::where('customer_id', $customer->id)
                ->where('status', 'open')
                ->first();
        }

        if ($sessionToken) {
            return Cart::where('session_token', $sessionToken)
                ->whereNull('customer_id')
                ->where('status', 'open')
                ->first();
        }

        return null;
    }

    protected function calculateTotals(
        ?Cart $cart,
        array $itemsInput,
        ?Customer $customer,
        string $shippingMethod,
        ?string $voucherCode,
        ?int $customerVoucherId,
        ?string $shippingCountry,
        ?string $shippingState,
        bool $allowMissingShippingAddress = false,
    ): array
    {
        $items = [];
        $subtotal = 0;

        if ($cart && $cart->items()->count() > 0) {
            $cart->loadMissing(['items.product', 'items.productVariant']);

            foreach ($cart->items as $cartItem) {
                $product = $cartItem->product;

                if (!$product || (!$cartItem->is_reward && !$product->is_active)) {
                    continue;
                }

                if ($cartItem->is_reward) {
                    if (!$customer) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward item is invalid or not owned by customer.'),
                        ])->status(422);
                    }

                    $redemption = $cartItem->reward_redemption_id
                        ? $customer->loyaltyRedemptions()
                            ->where('id', $cartItem->reward_redemption_id)
                            ->whereIn('status', ['pending', 'active'])
                            ->with('reward')
                            ->first()
                        : null;

                    if (!$redemption || !$redemption->reward) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward item is invalid or not owned by customer.'),
                        ])->status(422);
                    }

                    if ($redemption->reward->type !== 'product') {
                        throw ValidationException::withMessages([
                            'items' => __('Invalid reward type.'),
                        ])->status(422);
                    }

                    if ((int) $redemption->reward->product_id !== (int) $product->id) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward product mismatch.'),
                        ])->status(422);
                    }

                    if (data_get($redemption->meta, 'order_item_id')) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward already used.'),
                        ])->status(422);
                    }

                    $items[] = [
                        'product_id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->sku,
                        'quantity' => 1,
                        'unit_price' => 0.0,
                        'line_total' => 0.0,
                        'is_reward' => true,
                        'reward_redemption_id' => $cartItem->reward_redemption_id,
                        'locked' => true,
                    ];

                    continue;
                }

                if ($product->is_reward_only) {
                    throw ValidationException::withMessages([
                        'items' => __('Reward-only products cannot be purchased.'),
                    ])->status(422);
                }

                $variant = $this->resolveVariantForCheckout($product, $cartItem->product_variant_id);
                $pricing = ProductPricing::build($product, $variant);
                $unitPrice = (float) $pricing['effective_price'];
                $lineTotal = $unitPrice * (int) $cartItem->quantity;
                $priceChangeReason = ProductPricing::resolvePriceChangeReason(
                    (float) $cartItem->unit_price_snapshot,
                    $pricing,
                );
                $items[] = [
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'variant_name' => $variant?->title,
                    'variant_sku' => $variant?->sku,
                    'variant_price' => $variant?->price,
                    'variant_cost' => $variant?->cost_price,
                    'quantity' => (int) $cartItem->quantity,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'original_price' => $pricing['original_price'],
                    'sale_price' => $pricing['sale_price'],
                    'sale_price_start_at' => $pricing['sale_price_start_at'],
                    'sale_price_end_at' => $pricing['sale_price_end_at'],
                    'is_on_sale' => $pricing['is_on_sale'],
                    'effective_price' => $pricing['effective_price'],
                    'discount_percent' => $pricing['discount_percent'],
                    'price_changed' => $priceChangeReason !== null,
                    'price_change_reason' => $priceChangeReason,
                    'is_reward' => false,
                    'reward_redemption_id' => null,
                    'locked' => false,
                ];
                $subtotal += $lineTotal;
            }
        } else {
            if (empty($itemsInput)) {
                throw ValidationException::withMessages([
                    'items' => __('Cart is empty.'),
                ])->status(422);
            }

            foreach ($itemsInput as $input) {
                $isReward = (bool) ($input['is_reward'] ?? false);
                $redemptionId = $input['reward_redemption_id'] ?? null;
                $product = Product::find($input['product_id'] ?? null);

                if (!$product || (!$isReward && !$product->is_active)) {
                    continue;
                }

                if ($isReward) {
                    if (!$customer) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward item is invalid or not owned by customer.'),
                        ])->status(422);
                    }

                    $redemption = $redemptionId
                        ? $customer->loyaltyRedemptions()
                            ->where('id', $redemptionId)
                            ->whereIn('status', ['pending', 'active'])
                            ->with('reward')
                            ->first()
                        : null;

                    if (!$redemption || !$redemption->reward) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward item is invalid or not owned by customer.'),
                        ])->status(422);
                    }

                    if ($redemption->reward->type !== 'product') {
                        throw ValidationException::withMessages([
                            'items' => __('Invalid reward type.'),
                        ])->status(422);
                    }

                    if ((int) $redemption->reward->product_id !== (int) $product->id) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward product mismatch.'),
                        ])->status(422);
                    }

                    if (data_get($redemption->meta, 'order_item_id')) {
                        throw ValidationException::withMessages([
                            'items' => __('Reward already used.'),
                        ])->status(422);
                    }

                    $items[] = [
                        'product_id' => $product->id,
                        'name' => $product->name,
                        'sku' => $product->sku,
                        'quantity' => 1,
                        'unit_price' => 0.0,
                        'line_total' => 0.0,
                        'is_reward' => true,
                        'reward_redemption_id' => $redemptionId,
                        'locked' => true,
                    ];

                    continue;
                }

                if ($product->is_reward_only) {
                    throw ValidationException::withMessages([
                        'items' => __('Reward-only products cannot be purchased.'),
                    ])->status(422);
                }

                $variantId = $input['product_variant_id'] ?? null;
                $variant = $this->resolveVariantForCheckout($product, $variantId);
                $pricing = ProductPricing::build($product, $variant);
                $unitPrice = (float) $pricing['effective_price'];
                $lineTotal = $unitPrice * (int) ($input['quantity'] ?? 1);
                $items[] = [
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'name' => $product->name,
                    'sku' => $product->sku,
                    'variant_name' => $variant?->title,
                    'variant_sku' => $variant?->sku,
                    'variant_price' => $variant?->price,
                    'variant_cost' => $variant?->cost_price,
                    'quantity' => (int) ($input['quantity'] ?? 1),
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'original_price' => $pricing['original_price'],
                    'sale_price' => $pricing['sale_price'],
                    'sale_price_start_at' => $pricing['sale_price_start_at'],
                    'sale_price_end_at' => $pricing['sale_price_end_at'],
                    'is_on_sale' => $pricing['is_on_sale'],
                    'effective_price' => $pricing['effective_price'],
                    'discount_percent' => $pricing['discount_percent'],
                    'price_changed' => false,
                    'price_change_reason' => null,
                    'is_reward' => false,
                    'reward_redemption_id' => null,
                    'locked' => false,
                ];
                $subtotal += $lineTotal;
            }
        }

        $shippingFee = 0;
        $shippingInfo = null;
        if ($shippingMethod === 'shipping') {
            if ($allowMissingShippingAddress && (empty($shippingCountry) || empty($shippingState))) {
                $shippingFee = 0;
                $shippingInfo = null;
            } else {
                $shippingSetting = Setting::where('key', 'shipping')->first();
                $shippingConfig = (array) data_get($shippingSetting?->value, []);
                $shippingResult = $this->shippingService->calculateShippingFee(
                    $subtotal,
                    $shippingCountry,
                    $shippingState,
                    $shippingConfig,
                );

                $shippingFee = (float) $shippingResult['fee'];
                $shippingInfo = [
                    'zone' => $shippingResult['zone'],
                    'label' => $shippingResult['label'],
                    'fee' => $shippingFee,
                    'is_free' => $shippingResult['is_free'],
                    'free_shipping_min_order_amount' => $shippingResult['free_threshold'],
                ];
            }
        }
        $discountTotal = 0;
        $voucherData = null;
        $voucherError = null;
        $voucherResult = null;

        $customerVoucher = null;
        if ($customerVoucherId) {
            $customerVoucher = $customer ? $customer->customerVouchers()->where('id', $customerVoucherId)->with('voucher')->first() : null;
            if (!$customerVoucher) {
                return [
                    'items' => $items,
                    'subtotal' => $subtotal,
                    'discount_total' => 0,
                    'shipping_fee' => $shippingFee,
                    'grand_total' => $subtotal + $shippingFee,
                    'shipping' => $shippingInfo,
                    'voucher' => null,
                    'voucher_error' => __('Voucher not found.'),
                    'voucher_result' => null,
                    'voucher_valid' => false,
                ];
            }

            $voucherCode = $customerVoucher->voucher?->code ?? $voucherCode;
        }

        if ($voucherCode || $customerVoucher) {
            $voucherResult = $this->voucherService->validateAndCalculateDiscount($voucherCode ?? '', $customer, $subtotal, $customerVoucher, false);

            if ($voucherResult->valid) {
                $discountTotal = $voucherResult->discountAmount ?? 0;
                $voucherData = [
                    'id' => $voucherResult->voucherData['id'] ?? null,
                    'code' => $voucherResult->voucherData['code'] ?? $voucherCode,
                    'discount_amount' => $discountTotal,
                    'type' => $voucherResult->voucherData['type'] ?? null,
                    'value' => $voucherResult->voucherData['value'] ?? null,
                    'customer_voucher_id' => $voucherResult->customerVoucherId,
                ];
            } else {
                $voucherError = $voucherResult->error;
            }
        }

        $grandTotal = $subtotal - $discountTotal + $shippingFee;

        return [
            'items' => $items,
            'subtotal' => $subtotal,
            'discount_total' => $discountTotal,
            'shipping_fee' => $shippingFee,
            'grand_total' => $grandTotal,
            'shipping' => $shippingInfo,
            'voucher' => $voucherData,
            'voucher_error' => $voucherError,
            'voucher_result' => $voucherResult,
            'voucher_valid' => $voucherResult?->valid ?? false,
        ];
    }

    protected function removeOrderedCartItems(?Customer $customer, ?string $sessionToken, array $items): void
    {
        $itemsCollection = collect($items);
        $rewardRedemptionIds = $itemsCollection
            ->pluck('reward_redemption_id')
            ->filter()
            ->unique()
            ->values();

        $normalItems = $itemsCollection
            ->filter(fn($item) => empty($item['reward_redemption_id']))
            ->values();

        if ($normalItems->isEmpty() && $rewardRedemptionIds->isEmpty()) {
            return;
        }

        $cart = null;

        if ($sessionToken) {
            $cart = Cart::where('session_token', $sessionToken)
                ->where('status', 'open')
                ->first();
        }

        if (!$cart && $customer?->id) {
            $cart = Cart::where('customer_id', $customer->id)
                ->where('status', 'open')
                ->first();
        }

        if (!$cart) {
            return;
        }

        foreach ($normalItems as $item) {
            $cart->items()
                ->whereNull('reward_redemption_id')
                ->where('product_id', $item['product_id'])
                ->when(
                    !empty($item['product_variant_id']),
                    fn($query) => $query->where('product_variant_id', $item['product_variant_id']),
                    fn($query) => $query->whereNull('product_variant_id')
                )
                ->delete();
        }

        if ($rewardRedemptionIds->isNotEmpty()) {
            $cart->items()
                ->whereIn('reward_redemption_id', $rewardRedemptionIds)
                ->delete();
        }

        $cart->customer_id = $cart->customer_id ?: $customer?->id;

        if ($cart->items()->count() === 0) {
            $cart->status = 'converted';
        }

        $cart->save();
    }

    protected function generateOrderNumber(): string
    {
        return 'ORD' . Carbon::now()->format('YmdHis') . rand(100, 999);
    }

    protected function resolveVariantForCheckout(Product $product, ?int $variantId): ?ProductVariant
    {
        if ($product->type !== 'variant') {
            return null;
        }

        if (! $variantId) {
            throw ValidationException::withMessages([
                'items' => [
                    [
                        'product_id' => $product->id,
                        'message' => __('Variant is required for this product.'),
                    ],
                ],
            ])->status(422);
        }

        $variant = ProductVariant::where('id', $variantId)
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->first();

        if (! $variant) {
            throw ValidationException::withMessages([
                'items' => [
                    [
                        'product_id' => $product->id,
                        'message' => __('Selected variant is not available.'),
                    ],
                ],
            ])->status(422);
        }

        return $variant;
    }

    protected function resolveVariantPrice(Product $product, ?ProductVariant $variant): float
    {
        $pricing = ProductPricing::build($product, $variant);

        return (float) $pricing['effective_price'];
    }
}
