<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard Analytics Enhancement — Overview (single request).
 *
 * Combines the first-paint payloads that the CRM `/dashboard` page previously
 * fetched as 4–5 parallel HTTP calls into one endpoint, while reusing the same
 * payload builders as the legacy granular routes (contract-compatible slices).
 *
 * Tracking:
 * - DONE (this API): ecommerce + packages summary/filter-options/customer-packages + categories
 * - LEGACY (still available): /admin/dashboard/analytics/ecommerce, /packages/*
 * - NOT YET: sales / redemptions list endpoints, detail drawer, Redis cache
 */
class DashboardAnalyticsOverviewController extends Controller
{
    public const ENHANCEMENT = 'dashboard-analytics-overview-v1';

    public function __invoke(
        Request $request,
        StoreLocationAccessService $access,
        DashboardAnalyticsController $ecommerce,
        PackageDashboardAnalyticsController $packages,
    ) {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user, 401);

        $permissions = $user->isSuperAdmin()
            ? collect(['dashboard.analytics.view'])
            : $user->getAllPermissions();

        $canEcommerce = $permissions->contains(fn ($slug) => in_array($slug, [
            'dashboard.ecommerce_analytics.view',
            'dashboard.analytics.view',
        ], true));
        $canPackages = $permissions->contains(fn ($slug) => in_array($slug, [
            'dashboard.package_analytics.view',
            'dashboard.analytics.view',
        ], true));

        $include = $this->parseIncludes($request->query('include'));
        $wantEcommerce = $canEcommerce && in_array('ecommerce', $include, true);
        $wantPackages = $canPackages && in_array('packages', $include, true);
        $wantCategories = $wantEcommerce && in_array('categories', $include, true);

        abort_unless($wantEcommerce || $wantPackages, 403, 'No dashboard analytics permission.');

        $included = [];
        $payload = [
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'status' => 'done',
                'includes' => [],
                'legacy_endpoints' => [
                    'ecommerce' => '/api/admin/dashboard/analytics/ecommerce',
                    'packages_summary' => '/api/admin/dashboard/analytics/packages/summary',
                    'packages_filter_options' => '/api/admin/dashboard/analytics/packages/filter-options',
                    'packages_customer_packages' => '/api/admin/dashboard/analytics/packages/customer-packages',
                ],
                'not_yet' => [
                    'packages_sales_list' => '/api/admin/dashboard/analytics/packages/sales',
                    'packages_redemptions_list' => '/api/admin/dashboard/analytics/packages/redemptions',
                    'packages_customer_package_detail' => '/api/admin/dashboard/analytics/packages/customer-packages/{id}',
                ],
            ],
            'ecommerce' => null,
            'packages' => null,
            'categories' => null,
        ];

        if ($wantEcommerce) {
            $payload['ecommerce'] = $ecommerce->buildEcommercePayload($request, $access);
            $included[] = 'ecommerce';
        }

        if ($wantPackages) {
            $payload['packages'] = [
                'summary' => $packages->buildSummaryPayload($request),
                'filter_options' => $packages->buildFilterOptionsPayload(),
                'customer_packages' => $packages->buildCustomerPackagesPayload($request),
            ];
            $included[] = 'packages';
        }

        if ($wantCategories) {
            $payload['categories'] = $this->categoryOptions();
            $included[] = 'categories';
        }

        $payload['meta']['includes'] = $included;

        return response()->json($payload);
    }

    /**
     * @return list<string>
     */
    private function parseIncludes(mixed $raw): array
    {
        if (is_string($raw) && trim($raw) !== '') {
            $parts = array_values(array_filter(array_map('trim', explode(',', $raw))));
            if ($parts !== []) {
                return $parts;
            }
        }

        // Default first-paint set for the CRM dashboard page.
        return ['ecommerce', 'packages', 'categories'];
    }

    /**
     * Lightweight category list for the ecommerce inventory filter dropdown.
     *
     * @return list<array{id: int, name: string}>
     */
    private function categoryOptions(): array
    {
        if (! Schema::hasTable('categories')) {
            return [];
        }

        return DB::table('categories')
            ->orderBy('name')
            ->limit(500)
            ->get(['id', 'name'])
            ->map(fn ($row) => ['id' => (int) $row->id, 'name' => (string) $row->name])
            ->values()
            ->all();
    }
}
