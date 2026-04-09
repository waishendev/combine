<?php

namespace App\Services\Payments;

use App\Models\Ecommerce\PaymentGateway;
use App\Support\WorkspaceType;

class BillplzConfigResolver
{
    /**
     * @return array{
     *   api_key: string|null,
     *   collection_id: string|null,
     *   x_signature: string|null,
     *   base_url: string,
     *   frontend_url: string,
     *   public_url: string
     * }
     */
    public function resolve(string $type = WorkspaceType::ECOMMERCE, string $preferredKey = 'billplz_fpx'): array
    {
        if ($preferredKey === 'billplz_online_banking') {
            $preferredKey = 'billplz_fpx';
        } elseif ($preferredKey === 'billplz_credit_card') {
            $preferredKey = 'billplz_card';
        }

        $configs = PaymentGateway::query()
            ->where('type', $type)
            ->whereIn('key', ['billplz_fpx', 'billplz_card'])
            ->get(['key', 'config'])
            ->pluck('config', 'key');

        $preferredConfig = (array) ($configs[$preferredKey] ?? []);
        $fallbackConfig = (array) ($configs['billplz_fpx'] ?? []);

        $workspaceFrontend = config("services.frontend_url_{$type}");
        $defaultFrontend = config('services.billplz.frontend_url');

        return [
            'api_key' => data_get($preferredConfig, 'api_key')
                ?: data_get($fallbackConfig, 'api_key')
                ?: config('services.billplz.api_key'),
            'collection_id' => data_get($preferredConfig, 'collection_id')
                ?: data_get($fallbackConfig, 'collection_id')
                ?: config('services.billplz.collection_id'),
            'x_signature' => data_get($preferredConfig, 'x_signature')
                ?: data_get($fallbackConfig, 'x_signature')
                ?: config('services.billplz.x_signature'),
            'base_url' => rtrim((string) (data_get($preferredConfig, 'base_url')
                ?: data_get($fallbackConfig, 'base_url')
                ?: config('services.billplz.base_url')
                ?: 'https://www.billplz.com/api/v3'), '/'),
            'frontend_url' => rtrim((string) (data_get($preferredConfig, 'frontend_url')
                ?: data_get($fallbackConfig, 'frontend_url')
                ?: $workspaceFrontend
                ?: $defaultFrontend
                ?: ''), '/'),
            'public_url' => rtrim((string) (data_get($preferredConfig, 'public_url')
                ?: data_get($fallbackConfig, 'public_url')
                ?: config('services.billplz.public_url')
                ?: config('app.url')
                ?: ''), '/'),
        ];
    }
}
