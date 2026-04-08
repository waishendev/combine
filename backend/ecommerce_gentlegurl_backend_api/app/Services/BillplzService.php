<?php

namespace App\Services;

use App\Models\Ecommerce\Order;
use App\Services\Payments\BillplzConfigResolver;
use App\Support\WorkspaceType;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

        $isDirectOnlineBanking = $order->payment_method === 'billplz_online_banking' && $selectedGatewayCode;

        $payload = array_filter([
            'collection_id' => $collectionId,
            'email' => $email,
            'mobile' => $mobile,
            'name' => $order->shipping_name ?? $order->customer?->name ?? 'Customer',
            'amount' => (int) round(((float) $order->grand_total) * 100),
            'description' => 'Order ' . $order->order_number,
            'callback_url' => $callbackUrl,
            'redirect_url' => $redirectUrl,
            'reference_1_label' => $isDirectOnlineBanking ? 'Bank Code' : 'OrderNo',
            'reference_1' => $isDirectOnlineBanking ? $selectedGatewayCode : $order->order_number,
            'reference_2_label' => $isDirectOnlineBanking ? 'OrderNo' : null,
            'reference_2' => $isDirectOnlineBanking ? $order->order_number : null,
        ], fn($value) => $value !== null && $value !== '');

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

        $responseData = (array) $response->json();
        $originalUrl = (string) data_get($responseData, 'url', '');
        $resolvedUrl = $this->resolvePaymentUrl($originalUrl, (bool) $isDirectOnlineBanking);

        if ($resolvedUrl !== '' && $resolvedUrl !== $originalUrl) {
            $responseData['url'] = $resolvedUrl;
        }

        Log::info('Billplz bill created with routing context', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'payment_method' => $order->payment_method,
            'selected_gateway_option_id' => $order->billplz_gateway_option_id,
            'selected_gateway_code' => $selectedGatewayCode,
            'is_direct_online_banking' => $isDirectOnlineBanking,
            'billplz_gateway_option_id' => $order->billplz_gateway_option_id,
            'bill_payload' => $payload,
            'billplz_original_url' => $originalUrl,
            'billplz_final_url' => data_get($responseData, 'url'),
        ]);

        return $responseData;
    }

    private function resolvePaymentUrl(string $url, bool $isDirectOnlineBanking): string
    {
        if ($url === '' || ! $isDirectOnlineBanking) {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';

        return $url . $separator . http_build_query(['auto_submit' => 'true']);
    }
}
