<?php

namespace App\Http\Controllers;

use App\Models\Booking\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServicePackageController extends Controller
{
    public function index(Request $request)
    {
        $query = ServicePackage::query()->with(['items.bookingService:id,name']);

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $this->respond($query->orderByDesc('id')->paginate(min(100, max(1, (int) $request->query('per_page', 20)))));
    }

    public function show(int $id)
    {
        return $this->respond(ServicePackage::with(['items.bookingService:id,name'])->findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $pkg = DB::transaction(function () use ($data) {
            $pkg = ServicePackage::create(collect($data)->except('items')->all());
            $pkg->items()->createMany($data['items']);
            return $pkg->load(['items.bookingService:id,name']);
        });

        return $this->respond($pkg, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $pkg = ServicePackage::findOrFail($id);
        $data = $this->validatePayload($request);

        $pkg = DB::transaction(function () use ($pkg, $data) {
            $pkg->update(collect($data)->except('items')->all());
            $pkg->items()->delete();
            $pkg->items()->createMany($data['items']);
            return $pkg->load(['items.bookingService:id,name']);
        });

        return $this->respond($pkg);
    }

    public function destroy(int $id)
    {
        ServicePackage::findOrFail($id)->delete();
        return $this->respond(null);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'total_sessions' => ['required', 'integer', 'min:1'],
            'valid_days' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);
    }
}
