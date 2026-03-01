<?php

namespace App\Console\Commands;

use Database\Seeders\BookingTestingSeeder;
use Illuminate\Console\Command;

class BookingSeedTestingCommand extends Command
{
    protected $signature = 'booking:seed-testing {--fresh : Truncate booking-related tables before seeding}';

    protected $description = 'Seed booking module QA/testing data quickly';

    public function handle(): int
    {
        /** @var BookingTestingSeeder $seeder */
        $seeder = app(BookingTestingSeeder::class);
        $seeder->seedBookingTestingData((bool) $this->option('fresh'));

        $this->info('Booking testing data seeded successfully.');

        return self::SUCCESS;
    }
}
