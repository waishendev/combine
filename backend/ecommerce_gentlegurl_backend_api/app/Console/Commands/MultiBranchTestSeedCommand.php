<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Services\MultiBranchQaTestSeeder;
use Illuminate\Console\Command;

class MultiBranchTestSeedCommand extends Command
{
    protected $signature = 'multibranch:test-seed
        {--store-code= : Existing target Branch code}
        {--dry-run : Inspect the fixture plan without changing data}
        {--force : Seed the audited fixture plan}';

    protected $description = 'Prepare repeatable Branch-specific Multi-Branch QA data';

    public function handle(MultiBranchQaTestSeeder $seeder): int
    {
        if (app()->environment('production')) {
            $this->error('Multi-Branch QA Seeder cannot run in production.');
            return self::FAILURE;
        }

        $code = trim((string) $this->option('store-code'));
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        if ($code === '' || $dryRun === $force) {
            $this->error('Provide an explicit --store-code and exactly one of --dry-run or --force.');
            $this->line('  php artisan multibranch:test-seed --store-code=XXXX --dry-run');
            $this->line('  php artisan multibranch:test-seed --store-code=XXXX --force');
            return self::FAILURE;
        }

        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) {
            $this->error("Target Branch not found:\nstore_locations.code = {$code}");
            $this->line('Please create the Branch first, then rerun the command.');
            return self::FAILURE;
        }

        $audit = $seeder->audit($branch);
        $this->info($dryRun ? 'Multi-Branch QA Seeder — DRY RUN' : 'Multi-Branch QA Seeder');
        $this->table(['Target Branch', 'Value'], [['ID', $branch->id], ['Code', $branch->code], ['Name', $branch->name]]);
        $this->table(['Would prepare', 'Count'], collect($audit['planned'])->map(fn ($count, $name) => [$name, $count])->values()->all());
        foreach ($audit['warnings'] as $warning) {
            $this->warn($warning);
        }

        if ($dryRun) {
            $this->newLine();
            $this->info('DRY RUN ONLY — NO DATA CHANGED');
            return self::SUCCESS;
        }

        $result = $seeder->seed($branch, $audit);
        $this->table(['Result', 'Count'], [['Created', $result['created']], ['Updated', $result['updated']],
            ['Already existed', $result['existing']], ['Skipped', $result['skipped']], ['Warnings', $audit['warnings']->count()]]);
        $this->info('QA seed completed successfully.');

        return self::SUCCESS;
    }
}
