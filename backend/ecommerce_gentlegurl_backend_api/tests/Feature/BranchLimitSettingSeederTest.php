<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Services\BranchCapacityService;
use Database\Seeders\BranchLimitSettingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchLimitSettingSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_production_branch_limit_setting_idempotently(): void
    {
        $this->seed(BranchLimitSettingSeeder::class);
        $this->seed(BranchLimitSettingSeeder::class);

        $this->assertDatabaseCount('settings', 1);
        $setting = Setting::query()
            ->where('type', 'ecommerce')
            ->where('key', BranchCapacityService::SETTING_KEY)
            ->sole();

        $this->assertSame(BranchCapacityService::DEFAULT_LIMIT, $setting->value);
    }

    public function test_it_does_not_overwrite_an_existing_production_limit(): void
    {
        Setting::create([
            'type' => 'ecommerce',
            'key' => BranchCapacityService::SETTING_KEY,
            'value' => 5,
        ]);

        $this->seed(BranchLimitSettingSeeder::class);

        $this->assertSame(5, Setting::query()->where('key', BranchCapacityService::SETTING_KEY)->sole()->value);
    }
}
