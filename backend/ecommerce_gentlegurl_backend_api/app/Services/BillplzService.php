<?php

namespace App\Services;

use App\Models\Ecommerce\Order;
use App\Services\Payments\BillplzConfigResolver;
use App\Support\WorkspaceType;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class BillplzService
{
    public function __construct(
        protected BillplzConfigResolver $configResolver,
    ) {
    }

    /**
     * Create a Billplz bill for the given order.
     *
     * @return array<string, mixed>
     */
    public function createBill(Order $order, string $type = WorkspaceType::ECOMMERCE, ?string $selectedGatewayCode = null, array $extraPayload = []): array
    {
        $config = $this->configResolver->resolve($type, $order->payment_method ?: 'billplz_fpx');
        $apiKey = $config['api_key'];
        $collectionId = $config['collection_id'];
        $baseUrl = $config['base_url'];
        $frontendUrl = $config['frontend_url'];
        $publicUrl = $config['public_url'];

        if (!$apiKey || !$collectionId) {
            throw new RuntimeException('Billplz is not configured.');
        }

        $callbackUrl = $publicUrl ? "{$publicUrl}/api/public/payments/billplz/callback" : null;
        $redirectUrl = $frontendUrl
            ? $frontendUrl . '/payment-result?' . http_build_query([
                'order_no' => $order->order_number,
                'order_id' => $order->id,
                'provider' => 'billplz',
                'payment_method' => $order->payment_method,
            ])
            : null;

        $mobile = $order->shipping_phone ?? $order->customer?->phone;
        $email = $order->customer?->email;

        if (!$mobile && !$email) {
            throw new RuntimeException('Please provide a contact phone or email for the payment.');
        }

        $payload = array_filter([
            'collection_id' => $collectionId,
            'email' => $email,
            'mobile' => $mobile,
            'name' => $order->shipping_name ?? $order->customer?->name ?? 'Customer',
            'amount' => (int) round(((float) $order->grand_total) * 100),
            'description' => 'Order ' . $order->order_number,
            'callback_url' => $callbackUrl,
            'redirect_url' => $redirectUrl,
            'reference_1_label' => 'OrderNo',
            'reference_1' => $order->order_number,
        ], fn($value) => $value !== null && $value !== '');

        if ($selectedGatewayCode) {
            $payload['payment_channel'] = $selectedGatewayCode;
        }

        if (! empty($extraPayload)) {
            $payload = array_merge($payload, $extraPayload);
        }

        $response = Http::asForm()
            ->withBasicAuth($apiKey, '')
            ->acceptJson()
            ->post("{$baseUrl}/bills", $payload);

        if (!$response->successful()) {
            $errorBody = $response->json() ?? [];
            $message = data_get($errorBody, 'error.message');
            if (is_array($message)) {
                $message = implode(', ', $message);
            }
            $message = $message ?: $response->body();

            throw new RuntimeException('Failed to create Billplz bill: ' . $message);
        }

        return $response->json();
    }
}
