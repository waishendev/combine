<?php

namespace Database\Seeders;

use App\Models\Ecommerce\PaymentGateway;
use Illuminate\Database\Seeder;

class PaymentGatewaySeeder extends Seeder
{
    /**
     * @return array<string,mixed>
     */
    private function billplzConfig(string $type): array
    {
        $frontendByType = $type === 'booking'
            ? config('services.frontend_url_booking')
            : config('services.frontend_url_ecommerce');

        return array_filter([
            'api_key' => config('services.billplz.api_key'),
            'collection_id' => config('services.billplz.collection_id'),
            'x_signature' => config('services.billplz.x_signature'),
            'base_url' => config('services.billplz.base_url'),
            'frontend_url' => $frontendByType ?: config('services.billplz.frontend_url'),
            'public_url' => config('services.billplz.public_url') ?: config('app.url'),
        ], fn($value) => $value !== null && $value !== '');
    }

    public function run(): void
    {
        foreach (['ecommerce', 'booking'] as $type) {
            PaymentGateway::updateOrCreate(
                ['type' => $type, 'key' => 'manual_transfer'],
                [
                    'name' => 'Manual Bank Transfer',
                    'is_active' => true,
                    'is_default' => true,
                    'sort_order' => 1,
                ]
            );

            PaymentGateway::updateOrCreate(
                ['type' => $type, 'key' => 'billplz_fpx'],
                [
                    'name' => 'Online Banking (Billplz FPX)',
                    'is_active' => true,
                    'is_default' => false,
                    'sort_order' => 2,
                    'config' => $this->billplzConfig($type),
                ]
            );

            PaymentGateway::updateOrCreate(
                ['type' => $type, 'key' => 'billplz_card'],
                [
                    'name' => 'Credit Card (Billplz)',
                    'is_active' => true,
                    'is_default' => false,
                    'sort_order' => 3,
                    'config' => $this->billplzConfig($type),
                ]
            );
        }
    }
}
