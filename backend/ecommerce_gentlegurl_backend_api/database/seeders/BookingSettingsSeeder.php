<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Standalone seeder — safe to run repeatedly on an existing environment.
 *
 * php artisan db:seed --class=BookingSettingsSeeder
 */
class BookingSettingsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('settings')->updateOrInsert(
            ['type' => 'booking', 'key' => 'booking_max_advance_days'],
            [
                'value' => json_encode(60),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        DB::table('settings')->updateOrInsert(
            ['type' => 'booking', 'key' => 'BOOKING_MANUAL_TRANSFER_HOLD_MINUTES'],
            [
                'value' => json_encode(10),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        $this->command->info('Booking max advance days setting seeded.');
        $this->command->info('Booking manual transfer hold minutes setting seeded.');
    }
}
