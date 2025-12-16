<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StoreLocationController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $locations = StoreLocation::when($request->filled('name'), function ($query) use ($request) {
                $query->where('name', 'like', '%' . $request->get('name') . '%');
            })
            ->when($request->filled('code'), function ($query) use ($request) {
                $query->where('code', 'like', '%' . $request->get('code') . '%');
            })
            ->when($request->filled('city'), function ($query) use ($request) {
                $query->where('city', 'like', '%' . $request->get('city') . '%');
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', filter_var($request->get('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE));
            })
            ->orderBy('name')
            ->paginate($perPage);

        return $this->respond($locations);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'code' => ['required', 'string', 'max:50', 'unique:store_locations,code'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postcode' => ['required', 'string', 'max:20'],
            'country' => ['sometimes', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $location = StoreLocation::create($validated + ['is_active' => $validated['is_active'] ?? true]);

        return $this->respond($location, __('Store location created successfully.'));
    }

    public function show(StoreLocation $storeLocation)
    {
        return $this->respond($storeLocation);
    }

    public function update(Request $request, StoreLocation $storeLocation)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'code' => ['sometimes', 'string', 'max:50', Rule::unique('store_locations', 'code')->ignore($storeLocation->id)],
            'address_line1' => ['sometimes', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:100'],
            'state' => ['sometimes', 'string', 'max:100'],
            'postcode' => ['sometimes', 'string', 'max:20'],
            'country' => ['sometimes', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $storeLocation->fill($validated);
        $storeLocation->save();

        return $this->respond($storeLocation, __('Store location updated successfully.'));
    }

    public function destroy(StoreLocation $storeLocation)
    {
        $storeLocation->delete();

        return $this->respond(null, __('Store location deleted successfully.'));
    }
}
