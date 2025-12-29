<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
            ->with('images')
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
            'opening_hours' => ['nullable', 'array'],
            'image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        $location = StoreLocation::create($validated + ['is_active' => $validated['is_active'] ?? true]);

        if ($request->hasFile('image_file')) {
            $this->handleImageUpload($location, $request->file('image_file'), true);
        }

        return $this->respond($location->load('images'), __('Store location created successfully.'));
    }

    public function show(StoreLocation $storeLocation)
    {
        return $this->respond($storeLocation->load('images'));
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
            'opening_hours' => ['nullable', 'array'],
            'image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        $storeLocation->fill($validated);
        $storeLocation->save();

        if ($request->hasFile('image_file')) {
            $this->handleImageUpload($storeLocation, $request->file('image_file'), true);
        }

        return $this->respond($storeLocation->load('images'), __('Store location updated successfully.'));
    }

    public function destroy(StoreLocation $storeLocation)
    {
        foreach ($storeLocation->images as $image) {
            $imagePath = $image->getRawOriginal('image_path');
            if ($imagePath && Storage::disk('public')->exists($imagePath)) {
                Storage::disk('public')->delete($imagePath);
            }
        }

        $storeLocation->delete();

        return $this->respond(null, __('Store location deleted successfully.'));
    }

    protected function handleImageUpload(StoreLocation $storeLocation, UploadedFile $file, bool $replace = false): void
    {
        if ($replace) {
            $existingImages = $storeLocation->images()->get();
            foreach ($existingImages as $image) {
                $imagePath = $image->getRawOriginal('image_path');
                if ($imagePath && Storage::disk('public')->exists($imagePath)) {
                    Storage::disk('public')->delete($imagePath);
                }
                $image->delete();
            }
        }

        $filename = 'store-locations/' . $storeLocation->id . '/' . uniqid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('', $filename, 'public');

        $sortOrder = $replace ? 0 : $storeLocation->images()->count();

        StoreLocationImage::create([
            'store_location_id' => $storeLocation->id,
            'image_path' => $path,
            'sort_order' => $sortOrder,
        ]);
    }
}
