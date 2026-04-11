<?php

namespace App\Services\Payments;

use App\Models\Ecommerce\PaymentGateway;
use App\Support\BillplzBaseUrl;
use App\Support\WorkspaceType;
use Illuminate\Support\Facades\Log;

class BillplzConfigResolver
{
    /**
     * @return array{
     *   api_key: string|null,
     *   collection_id: string|null,
     *   x_signature: string|null,
     *   base_url: string,
     *   base_url_source: string,
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

        $baseFromPreferred = data_get($preferredConfig, 'base_url');
        $baseFromFallback = data_get($fallbackConfig, 'base_url');
        $baseFromEnv = config('services.billplz.base_url');
        $baseDefault = 'https://www.billplz.com/api/v3';

        if ($baseFromPreferred !== null && $baseFromPreferred !== '') {
            $baseUrlSource = "db:payment_gateways[{$type}.{$preferredKey}].config.base_url";
        } elseif ($baseFromFallback !== null && $baseFromFallback !== '') {
            $baseUrlSource = "db:payment_gateways[{$type}.billplz_fpx].config.base_url(fallback)";
        } elseif ($baseFromEnv !== null && $baseFromEnv !== '') {
            $baseUrlSource = 'env:BILPLZ_BASE_URL';
        } else {
            $baseUrlSource = 'default:' . $baseDefault;
        }

        $baseUrl = BillplzBaseUrl::normalize(rtrim((string) (
            $baseFromPreferred ?: $baseFromFallback ?: $baseFromEnv ?: $baseDefault
        ), '/'));

        if (config('services.billplz.log_resolved_config', true)) {
            Log::info('Billplz base_url resolved', [
                'workspace_type' => $type,
                'preferred_gateway_key' => $preferredKey,
                'raw_preferred' => $baseFromPreferred,
                'raw_fallback_billplz_fpx' => $baseFromFallback,
                'raw_env_services_billplz_base_url' => $baseFromEnv,
                'base_url_final' => $baseUrl,
                'base_url_source' => $baseUrlSource,
            ]);
        }

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
            'base_url' => $baseUrl,
            'base_url_source' => $baseUrlSource,
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
