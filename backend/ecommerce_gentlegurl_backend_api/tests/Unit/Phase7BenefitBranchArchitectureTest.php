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
        $this->assertStringNotContainsString("Schema::create('voucher_store_location'", $migration);
        $this->assertStringNotContainsString("Schema::create('loyalty_reward_store_location'", $migration);
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

    public function test_vouchers_and_rewards_are_global_while_attribution_remains(): void
    {
        $eligibility = file_get_contents(__DIR__.'/../../app/Services/Voucher/VoucherEligibilityService.php');
        $points = file_get_contents(__DIR__.'/../../app/Services/Loyalty/PointsService.php');
        $publicLoyalty = file_get_contents(__DIR__.'/../../app/Http/Controllers/Ecommerce/PublicLoyaltyController.php');
        $voucherUsage = file_get_contents(__DIR__.'/../../app/Services/Voucher/VoucherService.php');
        $packages = file_get_contents(__DIR__.'/../../app/Services/Booking/CustomerServicePackageService.php');
        $product = file_get_contents(__DIR__.'/../../app/Models/Ecommerce/Product.php');
        $backfill = file_get_contents(__DIR__.'/../../app/Console/Commands/BackfillBenefitBranchesCommand.php');

        $this->assertStringNotContainsString('storeLocationId', $eligibility);
        $this->assertStringNotContainsString('isApplicableAt(', $eligibility);
        $this->assertStringNotContainsString('isAvailableAt($storeLocationId)', $points);
        $this->assertStringContainsString("'store_location_id' => ['nullable'", $publicLoyalty);
        $this->assertStringContainsString("'store_location_id' => \$storeLocationId", $points);
        $this->assertStringContainsString("value('store_location_id')", $voucherUsage);
        $this->assertStringContainsString("'store_location_id' => \$this->resolveUsageBranch", $packages);
        $this->assertStringContainsString("where('customer_service_packages.customer_id', \$customerId)", $packages);
        $this->assertStringContainsString("belongsToMany(StoreLocation::class, 'store_location_product')", $product);
        $this->assertStringContainsString("where('idempotency_key', \$idempotencyKey)", $points);
        $this->assertStringContainsString('Dry-run complete; zero writes performed.', $backfill);
        $this->assertStringNotContainsString('store-code', $backfill);
        $this->assertStringNotContainsString('store_location_product_inventories', $backfill);
    }

    public function test_obsolete_applicability_schema_is_removed_for_already_migrated_environments(): void
    {
        $correction = file_get_contents(__DIR__.'/../../database/migrations/2027_02_01_000002_remove_phase_7_benefit_applicability.php');

        $this->assertStringContainsString("dropIfExists('voucher_store_location')", $correction);
        $this->assertStringContainsString("dropIfExists('loyalty_reward_store_location')", $correction);
        $this->assertStringNotContainsString('points_transactions', $correction);
        $this->assertStringNotContainsString('customer_service_package', $correction);
        $this->assertStringNotContainsString('loyalty_redemptions', $correction);
    }
}
