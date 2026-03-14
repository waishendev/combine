<?php

namespace App\Console\Commands;

use Database\Seeders\CommissionTestingSeeder;
use Illuminate\Console\Command;

class CommissionSeedTestingCommand extends Command
{
    protected $signature = 'booking:commission-seed-testing {--fresh : Truncate commission tables before seeding}';

    protected $description = 'Seed commission tiers/bookings/monthly fixtures for immediate QA testing';

    public function handle(): int
    {
        /** @var CommissionTestingSeeder $seeder */
        $seeder = app(CommissionTestingSeeder::class);
        $seeder->seedCommissionTestingData((bool) $this->option('fresh'));

        $this->info('Commission testing data seeded successfully.');

        return self::SUCCESS;
    }
}
