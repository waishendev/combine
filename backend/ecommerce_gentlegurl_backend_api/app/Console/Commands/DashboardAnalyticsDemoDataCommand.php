<?php

namespace App\Console\Commands;

use Database\Seeders\DashboardAnalyticsDemoSeeder;
use Illuminate\Console\Command;

class DashboardAnalyticsDemoDataCommand extends Command
{
    protected $signature = 'analytics:demo-data {--dry-run : Show what would be created without writing data} {--reset : Delete only ANALYTICS-DEMO data}';

    protected $description = 'Create, preview, or reset local/staging dashboard analytics demo data.';

    public function handle(): int
    {
        /** @var DashboardAnalyticsDemoSeeder $seeder */
        $seeder = app(DashboardAnalyticsDemoSeeder::class);

        if ($this->option('dry-run')) {
            $this->info('Dashboard analytics demo data dry run:');
            foreach ($seeder->dryRunSummary() as $key => $value) {
                $this->line(sprintf('- %s: %s', $key, is_bool($value) ? ($value ? 'yes' : 'no') : $value));
            }
            $this->line('- database_changes: none');

            return self::SUCCESS;
        }

        if ($this->option('reset')) {
            $deleted = $seeder->resetDemoData();
            $this->info('Dashboard analytics demo data reset complete:');
            foreach ($deleted as $key => $value) {
                $this->line(sprintf('- %s: %s', $key, $value));
            }

            return self::SUCCESS;
        }

        $seeder->seedDemoData();
        $this->info('Dashboard analytics demo data created/updated.');

        return self::SUCCESS;
    }
}
