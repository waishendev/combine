<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class Phase7BenefitBranchArchitectureTest extends TestCase
{
    public function test_global_masters_are_not_branch_partitioned(): void
    {
        $migration = file_get_contents(__DIR__.'/../../database/migrations/2027_02_01_000001_add_phase_7_benefit_branch_rules.php');

        $this->assertStringNotContainsString("Schema::table('customers'", $migration);
        $this->assertStringNotContainsString("Schema::table('service_packages'", $migration);
        $this->assertStringNotContainsString("Schema::table('customer_service_package_balances'", $migration);
        $this->assertStringNotContainsString('redeem_product_store_location', $migration);
        $this->assertStringContainsString("Schema::create('voucher_store_location'", $migration);
        $this->assertStringContainsString("Schema::create('loyalty_reward_store_location'", $migration);
    }

    public function test_transaction_attribution_is_nullable_and_inventory_is_not_activated(): void
    {
        $migration = file_get_contents(__DIR__.'/../../database/migrations/2027_02_01_000001_add_phase_7_benefit_branch_rules.php');
        $points = file_get_contents(__DIR__.'/../../app/Services/Loyalty/PointsService.php');

        $this->assertGreaterThanOrEqual(4, substr_count($migration, "foreignId('store_location_id')->nullable()"));
        $this->assertStringContainsString("'store_location_id' => \$storeLocationId", $points);
        $this->assertStringContainsString('$lockedProduct->stock', $points);
        $this->assertStringNotContainsString('StoreLocationProductInventory', $points);
        $this->assertStringNotContainsString('BranchInventoryMutationService', $points);
    }

    public function test_branch_rules_are_backend_enforced_and_idempotent(): void
    {
        $eligibility = file_get_contents(__DIR__.'/../../app/Services/Voucher/VoucherEligibilityService.php');
        $points = file_get_contents(__DIR__.'/../../app/Services/Loyalty/PointsService.php');
        $backfill = file_get_contents(__DIR__.'/../../app/Console/Commands/BackfillBenefitBranchesCommand.php');

        $this->assertStringContainsString('isApplicableAt($storeLocationId)', $eligibility);
        $this->assertStringContainsString('isAvailableAt($storeLocationId)', $points);
        $this->assertStringContainsString("where('idempotency_key', \$idempotencyKey)", $points);
        $this->assertStringContainsString('insertOrIgnore', $backfill);
        $this->assertStringContainsString('Dry-run complete; zero writes performed.', $backfill);
        $this->assertStringNotContainsString('store_location_product_inventories', $backfill);
    }
}
