<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class BillplzPaymentGatewayPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'ecommerce.billplz-payment-gateways.view' => 'Ecommerce Billplz Payment Gateways View',
        'ecommerce.billplz-payment-gateways.create' => 'Ecommerce Billplz Payment Gateways Create',
        'ecommerce.billplz-payment-gateways.update' => 'Ecommerce Billplz Payment Gateways Update',
        'ecommerce.billplz-payment-gateways.delete' => 'Ecommerce Billplz Payment Gateways Delete',
        'booking.billplz-payment-gateways.view' => 'Booking Billplz Payment Gateways View',
        'booking.billplz-payment-gateways.create' => 'Booking Billplz Payment Gateways Create',
        'booking.billplz-payment-gateways.update' => 'Booking Billplz Payment Gateways Update',
        'booking.billplz-payment-gateways.delete' => 'Booking Billplz Payment Gateways Delete',
    ];

    public function run(): void
    {
        $ecommerceGroup = PermissionGroup::firstOrCreate(
            ['name' => 'Ecommerce Billplz Payment Gateways'],
            ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]
        );
        $bookingGroup = PermissionGroup::firstOrCreate(
            ['name' => 'Booking Billplz Payment Gateways'],
            ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]
        );

        $ids = [];
        foreach (self::PERMISSIONS as $slug => $name) {
            $group = str_starts_with($slug, 'booking.') ? $bookingGroup : $ecommerceGroup;
            $ids[] = Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => 'Manage Billplz online banking / credit card payment options shown at checkout.',
                    'group_id' => $group->id,
                ]
            )->id;
        }

        $superAdminRole = Role::where('name', 'infra_core_x1')->first();
        if (! $superAdminRole) {
            $this->command?->error('Role infra_core_x1 not found. Permissions were created but not attached.');
            return;
        }

        $superAdminRole->permissions()->syncWithoutDetaching($ids);

        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->command?->info('Billplz payment gateway permissions synced to infra_core_x1.');
    }
}
