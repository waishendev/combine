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
use App\Models\Ecommerce\Cart;
use App\Models\BankAccount;
use App\Models\Setting;
use App\Models\BillplzBill;
use App\Services\Voucher\VoucherService;
use App\Services\Payments\BillplzClient;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;

class PublicCheckoutController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(protected VoucherService $voucherService)
    {
    }

    public function preview(Request $request)
    {
        $validated = $this->validateOrderRequest($request);
        $customer = $this->currentCustomer();
        $calculation = $this->calculateTotals(
            $validated['items'],
            $validated['voucher_code'] ?? null,
            $customer,
            $validated['shipping_method'] ?? 'pickup'
        );

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

        $calculation = $this->calculateTotals($validated['items'], $validated['voucher_code'] ?? null, $customer, $validated['shipping_method']);

        if (!empty($validated['voucher_code']) && (!$calculation['voucher_result'] || !$calculation['voucher_result']->valid)) {
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

        $order = DB::transaction(function () use ($validated, $customer, $calculation, $paymentMethod, $shippingAddressLine1, $shippingName, $shippingPhone, $bankAccount) {
            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'customer_id' => $customer?->id,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'payment_method' => $paymentMethod,
                'payment_gateway_id' => null,
                'bank_account_id' => $bankAccount?->id,
                'pickup_or_shipping' => $validated['shipping_method'],
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
            ]);

            foreach ($calculation['items'] as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'product_name_snapshot' => $item['name'],
                    'sku_snapshot' => $item['sku'] ?? null,
                    'price_snapshot' => $item['unit_price'],
                    'quantity' => $item['quantity'],
                    'line_total' => $item['line_total'],
                ]);
            }

            if (!empty($calculation['voucher']) && $calculation['voucher']['discount_amount'] > 0) {
                $voucher = $calculation['voucher'];
                OrderVoucher::create([
                    'order_id' => $order->id,
                    'voucher_id' => $voucher['id'] ?? null,
                    'code_snapshot' => $voucher['code'],
                    'discount_amount' => $voucher['discount_amount'],
                ]);

                if (!empty($voucher['id'])) {
                    $this->voucherService->recordUsage($voucher['id'], $customer?->id, $order->id);
                }
            }

            return $order;
        });

        if (!empty($validated['session_token'])) {
            $cart = Cart::where('session_token', $validated['session_token'])
                ->where('status', 'open')
                ->first();

            if ($cart) {
                $cart->customer_id = $cart->customer_id ?: $customer?->id;
                $cart->status = 'converted';
                $cart->save();

                $cart->items()->delete();
            }
        }

        $billplzUrl = null;

        if ($paymentMethod === 'billplz_fpx') {
            /** @var BillplzClient $billplz */
            $billplz = App::make(BillplzClient::class);

            $amountSen = (int) round((float) $order->grand_total * 100);
            $payerName = $validated['shipping_name'] ?? $customer?->name ?? 'Guest';

            $billResponse = $billplz->createBill([
                'name' => $payerName,
                'email' => $customer?->email,
                'phone' => $validated['shipping_phone'] ?? $customer?->phone,
                'amount_sen' => $amountSen,
                'reference_1' => $order->order_number,
            ]);

            BillplzBill::create([
                'order_id' => $order->id,
                'billplz_id' => $billResponse['id'] ?? null,
                'collection_id' => $billResponse['collection_id'] ?? null,
                'state' => $billResponse['state'] ?? null,
                'paid' => false,
                'amount' => $amountSen,
                'payload' => $billResponse,
            ]);

            $billplzUrl = $billResponse['url'] ?? null;
        }

        return $this->respond([
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'grand_total' => $order->grand_total,
            'payment_status' => $order->payment_status,
            'status' => $order->status,
            'payment_method' => $paymentMethod,
            'payment' => [
                'provider' => $paymentMethod === 'billplz_fpx' ? 'billplz' : 'manual',
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
                'created_at' => $upload->created_at,
            ]);

        return $this->respond([
            'order_id' => $order->id,
            'order_no' => $order->order_number,
            'grand_total' => $order->grand_total,
            'payment_method' => $order->payment_method,
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
        $validated = $request->validate([
            'file_url' => ['required', 'url'],
        ]);

        $upload = OrderUpload::create([
            'order_id' => $order->id,
            'type' => 'payment_slip',
            'file_url' => $validated['file_url'],
        ]);

        return $this->respond($upload, __('Payment slip uploaded.'));
    }

    protected function validateOrderRequest(Request $request, bool $requirePaymentMethod = false): array
    {
        return $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'voucher_code' => ['nullable', 'string'],
            'shipping_method' => ['required', 'in:pickup,shipping'],
            'store_location_id' => ['required_if:shipping_method,pickup', 'integer'],
            'shipping_postcode' => ['nullable', 'string'],
            'customer' => ['nullable', 'array'],
            'customer.name' => ['required_with:customer', 'string'],
            'customer.email' => ['required_with:customer', 'email'],
            'customer.phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'shipping_name' => ['nullable', 'string'],
            'shipping_phone' => ['nullable', 'string'],
            'shipping_address_line1' => ['nullable', 'string'],
            'shipping_address_line2' => ['nullable', 'string'],
            'shipping_city' => ['nullable', 'string'],
            'shipping_state' => ['nullable', 'string'],
            'shipping_country' => ['nullable', 'string'],
            'session_token' => ['nullable', 'string', 'max:100'],
            'payment_method' => [$requirePaymentMethod ? 'required' : 'nullable', 'string', 'in:manual_transfer,billplz_fpx'],
            'bank_account_id' => [
                $requirePaymentMethod ? 'required_if:payment_method,manual_transfer' : 'nullable',
                'nullable',
                'integer',
                'exists:bank_accounts,id',
            ],
        ]);
    }

    protected function calculateTotals(array $itemsInput, ?string $voucherCode, ?Customer $customer, string $shippingMethod): array
    {
        $items = [];
        $subtotal = 0;
        foreach ($itemsInput as $input) {
            $product = Product::find($input['product_id']);
            if (!$product || !$product->is_active) {
                continue;
            }
            $lineTotal = (float) $product->price * (int) $input['quantity'];
            $items[] = [
                'product_id' => $product->id,
                'name' => $product->name,
                'sku' => $product->sku,
                'quantity' => (int) $input['quantity'],
                'unit_price' => (float) $product->price,
                'line_total' => $lineTotal,
            ];
            $subtotal += $lineTotal;
        }

        $shippingFee = 0;
        if ($shippingMethod === 'shipping') {
            $shippingSetting = Setting::where('key', 'shipping')->first();

            $shippingFee = (float) data_get($shippingSetting?->value, 'flat_fee', 0);
        }
        $discountTotal = 0;
        $voucherData = null;
        $voucherError = null;
        $voucherResult = null;

        if ($voucherCode) {
            $voucherResult = $this->voucherService->validateAndCalculateDiscount($voucherCode, $customer, $subtotal);

            if ($voucherResult->valid) {
                $discountTotal = $voucherResult->discountAmount ?? 0;
                $voucherData = [
                    'id' => $voucherResult->voucherData['id'] ?? null,
                    'code' => $voucherResult->voucherData['code'] ?? $voucherCode,
                    'discount_amount' => $discountTotal,
                    'type' => $voucherResult->voucherData['type'] ?? null,
                    'value' => $voucherResult->voucherData['value'] ?? null,
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
            'voucher' => $voucherData,
            'voucher_error' => $voucherError,
            'voucher_result' => $voucherResult,
            'voucher_valid' => $voucherResult?->valid ?? false,
        ];
    }

    protected function generateOrderNumber(): string
    {
        return 'ORD' . Carbon::now()->format('YmdHis') . rand(100, 999);
    }
}
