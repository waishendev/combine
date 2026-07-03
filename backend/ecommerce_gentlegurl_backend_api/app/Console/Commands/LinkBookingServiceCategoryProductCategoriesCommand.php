<?php

namespace App\Console\Commands;

use App\Models\Booking\BookingServiceCategory;
use App\Services\Booking\BookingServiceCategoryProductLinkService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LinkBookingServiceCategoryProductCategoriesCommand extends Command
{
    protected $signature = 'booking:link-category-product-categories
        {--dry-run : Preview links without writing}
        {--create-missing : Create a product category when no name match exists}
        {--sync-fields : Sync name/cn_name/sort_order/is_active to already-linked product categories}';

    protected $description = 'Backfill booking_service_categories.linked_booking_product_category_id from Booking → Product Categories name matches';

    public function __construct(
        private readonly BookingServiceCategoryProductLinkService $linkService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $createMissing = (bool) $this->option('create-missing');
        $syncFields = (bool) $this->option('sync-fields');

        if (! Schema::hasTable('booking_service_categories') || ! Schema::hasTable('booking_product_categories')) {
            $this->error('Required tables are missing. Run migrations first.');

            return self::FAILURE;
        }

        if (! Schema::hasColumn('booking_service_categories', 'linked_booking_product_category_id')) {
            $this->error('Column booking_service_categories.linked_booking_product_category_id is missing.');
            $this->line('Run migration 2026_07_03_000003_add_linked_booking_product_category_id_to_booking_service_categories_table first.');

            return self::FAILURE;
        }

        $categories = BookingServiceCategory::query()->orderBy('id')->get();

        $linked = 0;
        $created = 0;
        $synced = 0;
        $alreadyLinked = 0;
        $skipped = 0;
        $failedRows = [];
        $actionRows = [];

        $run = function () use (
            $categories,
            $dryRun,
            $createMissing,
            $syncFields,
            &$linked,
            &$created,
            &$synced,
            &$alreadyLinked,
            &$skipped,
            &$failedRows,
            &$actionRows,
        ) {
            foreach ($categories as $serviceCategory) {
                $serviceCategoryId = (int) $serviceCategory->id;

                if ($serviceCategory->linked_booking_product_category_id) {
                    if ($syncFields) {
                        if (! $dryRun) {
                            $this->linkService->syncLinkedProductCategory($serviceCategory, false);
                        }
                        $synced++;
                        $actionRows[] = [
                            'service_category_id' => $serviceCategoryId,
                            'service_category_name' => (string) $serviceCategory->name,
                            'action' => $dryRun ? 'would sync fields' : 'synced fields',
                            'product_category_id' => (int) $serviceCategory->linked_booking_product_category_id,
                        ];
                    } else {
                        $alreadyLinked++;
                    }

                    continue;
                }

                $matches = $this->linkService->findProductCategoryNameMatches(
                    $serviceCategory->name,
                    $serviceCategory->cn_name,
                );

                if ($matches->count() > 1) {
                    $skipped++;
                    $failedRows[] = [
                        'service_category_id' => $serviceCategoryId,
                        'service_category_name' => (string) $serviceCategory->name,
                        'reason' => 'Multiple product categories match: '.$matches->pluck('id')->join(', '),
                    ];

                    continue;
                }

                if ($matches->count() === 1) {
                    $productCategoryId = (int) $matches->first()->id;
                    $actionRows[] = [
                        'service_category_id' => $serviceCategoryId,
                        'service_category_name' => (string) $serviceCategory->name,
                        'action' => $dryRun ? 'would link' : 'linked',
                        'product_category_id' => $productCategoryId,
                    ];

                    if (! $dryRun) {
                        $serviceCategory->update([
                            'linked_booking_product_category_id' => $productCategoryId,
                        ]);
                        if ($syncFields) {
                            $this->linkService->syncLinkedProductCategory($serviceCategory->fresh(), false);
                        }
                    }

                    $linked++;

                    continue;
                }

                if ($createMissing) {
                    $actionRows[] = [
                        'service_category_id' => $serviceCategoryId,
                        'service_category_name' => (string) $serviceCategory->name,
                        'action' => $dryRun ? 'would create + link' : 'created + linked',
                        'product_category_id' => '-',
                    ];

                    if (! $dryRun) {
                        $this->linkService->linkAfterCreate($serviceCategory);
                    }

                    $created++;

                    continue;
                }

                $skipped++;
                $failedRows[] = [
                    'service_category_id' => $serviceCategoryId,
                    'service_category_name' => (string) $serviceCategory->name,
                    'reason' => 'No matching product category found. Use --create-missing to create one.',
                ];
            }
        };

        if ($dryRun) {
            $run();
        } else {
            DB::transaction($run);
        }

        $this->newLine();
        $this->info($dryRun ? 'Dry run complete. No changes were saved.' : 'Category product link complete.');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total service categories scanned', $categories->count()],
                [$dryRun ? 'Would link by name match' : 'Linked by name match', $linked],
                [$dryRun ? 'Would create + link' : 'Created + linked', $created],
                [$syncFields ? ($dryRun ? 'Would sync fields on existing links' : 'Synced fields on existing links') : 'Already linked (FK set)', $syncFields ? $synced : $alreadyLinked],
                ['Skipped / no match / ambiguous', $skipped],
            ],
        );

        if (count($actionRows) > 0) {
            $this->newLine();
            $this->warn($dryRun ? 'Planned actions:' : 'Actions taken:');
            $this->table(
                ['Service Category ID', 'Name', 'Action', 'Product Category ID'],
                collect($actionRows)->map(fn (array $row) => [
                    $row['service_category_id'],
                    $row['service_category_name'],
                    $row['action'],
                    $row['product_category_id'],
                ])->all(),
            );
        }

        if (count($failedRows) > 0) {
            $this->newLine();
            $this->warn('Service categories that were not linked:');
            $this->table(
                ['Service Category ID', 'Name', 'Reason'],
                collect($failedRows)->map(fn (array $row) => [
                    $row['service_category_id'],
                    $row['service_category_name'],
                    $row['reason'],
                ])->all(),
            );
        }

        if ($dryRun) {
            $this->newLine();
            $this->line('Run without --dry-run to apply. Add --create-missing only if you want new Product Categories created.');
        }

        return self::SUCCESS;
    }
}
