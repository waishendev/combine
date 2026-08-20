<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard Analytics Enhancement — Overview (single request).
 *
 * Page: CRM /dashboard first paint.
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
            // First paint only needs enhancement id + which slices were built.
            'meta' => [
                'enhancement' => self::ENHANCEMENT,
                'includes' => [],
            ],
            'ecommerce' => null,
            'packages' => null,
            'categories' => null,
        ];

        if ($wantEcommerce) {
            $payload['ecommerce'] = $ecommerce->buildEcommercePayload($request, $access, forOverview: true);
            $included[] = 'ecommerce';
        }

        if ($wantPackages) {
            // Overview shares ecommerce query params (status=active for products).
            // Package liability must not inherit that product status filter.
            $packageRequest = $this->packageRequestFromOverview($request);
            $payload['packages'] = [
                'summary' => $packages->buildSummaryPayload($packageRequest, forOverview: true),
                'filter_options' => $packages->buildFilterOptionsPayload(),
                'customer_packages' => $packages->buildCustomerPackagesPayload($packageRequest, forOverview: true),
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
     * Strip ecommerce-only filters so package builders keep legacy behavior.
     */
    private function packageRequestFromOverview(Request $request): Request
    {
        $query = $request->query();
        unset($query['status'], $query['search'], $query['category_id'], $query['low_stock'], $query['missing_cost']);

        if ($request->filled('package_status')) {
            $query['status'] = $request->query('package_status');
        }
        if ($request->filled('package_search')) {
            $query['search'] = $request->query('package_search');
        }

        $packageRequest = Request::create($request->url(), 'GET', $query);
        $packageRequest->setUserResolver($request->getUserResolver());
        foreach ($request->attributes->all() as $key => $value) {
            $packageRequest->attributes->set($key, $value);
        }

        return $packageRequest;
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
        $tables = request()->attributes->get('_dash_schema_tables', []);
        $categoriesExist = is_array($tables) && array_key_exists('categories', $tables)
            ? (bool) $tables['categories']
            : \Illuminate\Support\Facades\Schema::hasTable('categories');

        if (! $categoriesExist) {
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
