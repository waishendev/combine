<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Customer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoMembersSeederTesting extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'email' => 'member.demo1@example.com',
                'name' => 'Demo Member 1',
                'phone' => '0111111111',
            ],
            [
                'email' => 'member.demo2@example.com',
                'name' => 'Demo Member 2',
                'phone' => '0111111112',
            ],
            [
                'email' => 'member.demo3@example.com',
                'name' => 'Demo Member 3',
                'phone' => '0111111113',
            ],
        ];

        foreach ($rows as $row) {
            Customer::updateOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'phone' => $row['phone'],
                    'password' => Hash::make('password'),
                    'tier' => 'gold',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}
