<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServicePackageController extends Controller
{
    public function index(Request $request)
    {
        $query = trim((string) $request->query('search', ''));
        $builder = ServicePackage::query()->with(['items.bookingService']);

        if ($query !== '') {
            $builder->where('name', 'like', "%{$query}%");
        }

        $packages = $builder->orderByDesc('id')->paginate(20);

        return $this->respond([
            'data' => collect($packages->items())->map(fn (ServicePackage $package) => $this->mapPackage($package))->values(),
            'current_page' => $packages->currentPage(),
            'last_page' => $packages->lastPage(),
            'per_page' => $packages->perPage(),
            'total' => $packages->total(),
        ]);
    }

    public function show(ServicePackage $servicePackage)
    {
        $servicePackage->load(['items.bookingService']);

        return $this->respond($this->mapPackage($servicePackage));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $package = DB::transaction(function () use ($validated) {
            $package = ServicePackage::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            foreach ($validated['items'] as $item) {
                $package->items()->create([
                    'booking_service_id' => (int) $item['booking_service_id'],
                    'quantity' => (int) $item['quantity'],
                ]);
            }

            return $package;
        });

        $package->load(['items.bookingService']);

        return $this->respond($this->mapPackage($package));
    }

    public function update(Request $request, ServicePackage $servicePackage)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        DB::transaction(function () use ($validated, $servicePackage) {
            $servicePackage->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $servicePackage->items()->delete();
            foreach ($validated['items'] as $item) {
                $servicePackage->items()->create([
                    'booking_service_id' => (int) $item['booking_service_id'],
                    'quantity' => (int) $item['quantity'],
                ]);
            }
        });

        $servicePackage->load(['items.bookingService']);

        return $this->respond($this->mapPackage($servicePackage));
    }

    public function destroy(ServicePackage $servicePackage)
    {
        $servicePackage->delete();
        return $this->respond(['ok' => true]);
    }

    private function mapPackage(ServicePackage $package): array
    {
        return [
            'id' => (int) $package->id,
            'name' => $package->name,
            'description' => $package->description,
            'is_active' => (bool) $package->is_active,
            'items' => $package->items->map(function ($item) {
                return [
                    'id' => (int) $item->id,
                    'booking_service_id' => (int) $item->booking_service_id,
                    'service_name' => $item->bookingService?->name,
                    'quantity' => (int) $item->quantity,
                ];
            })->values()->all(),
        ];
    }
}
