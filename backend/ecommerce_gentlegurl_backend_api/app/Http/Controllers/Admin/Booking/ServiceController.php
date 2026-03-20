<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index() { return $this->respond(BookingService::latest()->paginate(20)); }
    public function show(int $id) { return $this->respond(BookingService::findOrFail($id)); }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['nullable', 'numeric', 'min:0'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'duration_min' => ['required', 'integer', 'min:1'],
            'deposit_amount' => ['required', 'numeric', 'min:0'],
            'buffer_min' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'rules_json' => ['nullable', 'array'],
        ]);
        $data['service_price'] = $data['service_price'] ?? 0;
        $data['price'] = $data['price'] ?? $data['service_price'];
        $data['is_package_eligible'] = (bool) ($data['is_package_eligible'] ?? true);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $service = BookingService::create($data);
        BookingLog::create(['actor_type' => 'ADMIN', 'actor_id' => optional($request->user())->id, 'action' => 'UPDATE_SERVICE', 'meta' => ['service_id' => $service->id], 'created_at' => now()]);
        return $this->respond($service, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $service = BookingService::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'description' => ['nullable', 'string'],
            'service_type' => ['required', 'in:premium,standard'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_price' => ['sometimes', 'numeric', 'min:0'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'is_package_eligible' => ['sometimes', 'boolean'],
            'duration_min' => ['sometimes', 'integer', 'min:1'],
            'deposit_amount' => ['sometimes', 'numeric', 'min:0'],
            'buffer_min' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'rules_json' => ['nullable', 'array'],
        ]);

        $oldImagePath = $service->image_path;
        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/service-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $service->update($data);

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        BookingLog::create(['actor_type' => 'ADMIN', 'actor_id' => optional($request->user())->id, 'action' => 'UPDATE_SERVICE', 'meta' => ['service_id' => $service->id], 'created_at' => now()]);
        return $this->respond($service->fresh());
    }

    public function destroy(int $id)
    {
        $service = BookingService::findOrFail($id);
        $service->delete();
        return $this->respond(null);
    }
}
