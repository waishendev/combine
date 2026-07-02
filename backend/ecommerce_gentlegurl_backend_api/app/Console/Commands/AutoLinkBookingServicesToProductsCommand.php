<?php

namespace App\Console\Commands;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingService;
use App\Services\Booking\BookingServiceProductLinkService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AutoLinkBookingServicesToProductsCommand extends Command
{
    protected $signature = 'booking:auto-link-products
        {--dry-run : Preview matches without saving}
        {--force : Re-link services that are already linked to a different product}';

    protected $description = 'Link booking services to booking products when English and Chinese names match';

    public function __construct(
        private readonly BookingServiceProductLinkService $productLinkService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        $products = BookingProduct::query()
            ->orderBy('id')
            ->get(['id', 'name', 'cn_name']);

        $productGroups = [];
        foreach ($products as $product) {
            $key = $this->buildMatchKey($product->name, $product->cn_name);
            $productGroups[$key][] = $product;
        }

        $services = BookingService::query()
            ->orderBy('id')
            ->get(['id', 'name', 'cn_name', 'linked_booking_product_id']);

        $linked = 0;
        $alreadyLinked = 0;
        $skipped = 0;
        $failedRows = [];

        $run = function () use (
            $services,
            $productGroups,
            $dryRun,
            $force,
            &$linked,
            &$alreadyLinked,
            &$skipped,
            &$failedRows,
        ) {
            foreach ($services as $service) {
                $key = $this->buildMatchKey($service->name, $service->cn_name);
                $matches = $productGroups[$key] ?? [];

                if (count($matches) === 0) {
                    $failedRows[] = [
                        'service_id' => (int) $service->id,
                        'service_name' => (string) $service->name,
                        'service_cn_name' => (string) ($service->cn_name ?? ''),
                        'reason' => 'No booking product found with the same English and Chinese name.',
                    ];
                    continue;
                }

                if (count($matches) > 1) {
                    $failedRows[] = [
                        'service_id' => (int) $service->id,
                        'service_name' => (string) $service->name,
                        'service_cn_name' => (string) ($service->cn_name ?? ''),
                        'reason' => 'Multiple booking products match: ' . collect($matches)->pluck('id')->join(', '),
                    ];
                    continue;
                }

                $product = $matches[0];
                $currentLinkedProductId = $service->linked_booking_product_id ? (int) $service->linked_booking_product_id : null;
                $targetProductId = (int) $product->id;

                if ($currentLinkedProductId === $targetProductId) {
                    $alreadyLinked++;
                    continue;
                }

                if ($currentLinkedProductId !== null && ! $force) {
                    $skipped++;
                    $failedRows[] = [
                        'service_id' => (int) $service->id,
                        'service_name' => (string) $service->name,
                        'service_cn_name' => (string) ($service->cn_name ?? ''),
                        'reason' => sprintf(
                            'Already linked to product #%d. Use --force to replace with product #%d.',
                            $currentLinkedProductId,
                            $targetProductId,
                        ),
                    ];
                    continue;
                }

                if (! $dryRun) {
                    $this->productLinkService->assignProductLink($service, $targetProductId);
                }

                $linked++;
            }
        };

        if ($dryRun) {
            $run();
        } else {
            DB::transaction($run);
        }

        $failed = count($failedRows);
        $total = $services->count();

        $this->newLine();
        $this->info($dryRun ? 'Dry run complete. No changes were saved.' : 'Auto-link complete.');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Total booking services scanned', $total],
                ['Newly linked', $linked],
                ['Already linked correctly', $alreadyLinked],
                ['Not linked / failed', $failed],
                ['Skipped (already linked elsewhere)', $skipped],
            ],
        );

        if ($failed > 0) {
            $this->newLine();
            $this->warn('Services that were not linked:');
            $this->table(
                ['Service ID', 'English Name', 'Chinese Name', 'Reason'],
                collect($failedRows)->map(fn (array $row) => [
                    $row['service_id'],
                    $row['service_name'],
                    $row['service_cn_name'] !== '' ? $row['service_cn_name'] : '-',
                    $row['reason'],
                ])->all(),
            );
        }

        return self::SUCCESS;
    }

    private function buildMatchKey(?string $englishName, ?string $chineseName): string
    {
        $english = mb_strtolower(trim((string) $englishName));
        $chinese = trim((string) $chineseName);

        return $english . '||' . $chinese;
    }
}
