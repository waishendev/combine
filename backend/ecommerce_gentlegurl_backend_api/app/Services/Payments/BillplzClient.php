<?php

namespace App\Services\Payments;

use Billplz\Client as BillplzClientSdk;

class BillplzClient
{
    protected BillplzClientSdk $client;

    protected ?string $collectionId;

    protected ?string $callbackUrl;

    protected ?string $redirectUrl;

    public function __construct()
    {
        $apiKey = config('services.billplz.api_key');
        $xSignature = config('services.billplz.x_signature');
        $sandbox = (bool) config('services.billplz.sandbox', true);

        $this->collectionId = config('services.billplz.collection_id');
        $this->callbackUrl = config('services.billplz.callback_url');
        $this->redirectUrl = config('services.billplz.redirect_url');

        $this->client = BillplzClientSdk::make($apiKey, $xSignature);

        if ($sandbox) {
            $this->client->useSandbox();
        }
    }

    /**
     * @param array{
     *   name: string,
     *   email?: string|null,
     *   phone?: string|null,
     *   amount_sen: int,
     *   reference_1: string,
     * } $data
     */
    public function createBill(array $data): array
    {
        $bill = $this->client->bill();

        $response = $bill->create(
            $this->collectionId,
            $data['email'] ?? null,
            $data['phone'] ?? null,
            $data['name'],
            $data['amount_sen'],
            [
                'callback_url' => $this->callbackUrl,
                'redirect_url' => $this->redirectUrl,
                'reference_1' => $data['reference_1'],
                'description' => 'Order ' . $data['reference_1'],
            ]
        );

        return $response->toArray();
    }
}
