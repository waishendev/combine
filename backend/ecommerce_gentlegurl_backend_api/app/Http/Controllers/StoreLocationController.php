<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
use Illuminate\Http\Request;
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
            'opening_hours.*' => ['string', 'max:255'],
            'images' => ['nullable', 'array', 'max:6'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        if ($request->hasFile('images') && count($request->file('images')) > 6) {
            return $this->respond(null, __('A maximum of 6 images is allowed.'), false, 422);
        }

        $location = StoreLocation::create($validated + ['is_active' => $validated['is_active'] ?? true]);

        if ($request->hasFile('images')) {
            $this->handleImageUploads($location, $request->file('images'));
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
            'opening_hours.*' => ['string', 'max:255'],
            'images' => ['nullable', 'array', 'max:6'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'delete_image_ids' => ['nullable', 'array'],
            'delete_image_ids.*' => ['integer', 'exists:store_location_images,id'],
            'image_order' => ['nullable', 'array'],
            'image_order.*' => ['string', 'max:50'],
        ]);

        $existingImages = $storeLocation->images()->count();
        $deleteCount = $request->filled('delete_image_ids')
            ? $storeLocation->images()->whereIn('id', $validated['delete_image_ids'])->count()
            : 0;
        $newImagesCount = $request->hasFile('images') ? count($request->file('images')) : 0;

        if (($existingImages - $deleteCount + $newImagesCount) > 6) {
            return $this->respond(null, __('A maximum of 6 images is allowed.'), false, 422);
        }

        $storeLocation->fill($validated);
        $storeLocation->save();

        $createdImages = [];

        if ($request->filled('delete_image_ids')) {
            $this->deleteImages($storeLocation, $validated['delete_image_ids']);
        }

        if ($request->hasFile('images')) {
            $createdImages = $this->handleImageUploads($storeLocation, $request->file('images'));
        }

        if ($request->filled('image_order')) {
            $this->syncImageOrder($storeLocation, $validated['image_order'], $createdImages);
        }

        return $this->respond($storeLocation->load('images'), __('Store location updated successfully.'));
    }

    public function destroy(StoreLocation $storeLocation)
    {
        $this->deleteImages($storeLocation);

        $storeLocation->delete();

        return $this->respond(null, __('Store location deleted successfully.'));
    }

    protected function handleImageUploads(StoreLocation $storeLocation, array $files): array
    {
        $existingImagesCount = $storeLocation->images()->count();
        $createdImages = [];

        foreach ($files as $index => $file) {
            $filename = 'store-locations/' . $storeLocation->id . '/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('', $filename, 'public');

            $createdImages[] = StoreLocationImage::create([
                'store_location_id' => $storeLocation->id,
                'image_path' => $path,
                'sort_order' => $existingImagesCount + $index,
            ]);
        }

        return $createdImages;
    }

    protected function deleteImages(StoreLocation $storeLocation, ?array $imageIds = null): void
    {
        $images = $storeLocation->images()
            ->when($imageIds !== null, function ($query) use ($imageIds) {
                $query->whereIn('id', $imageIds);
            })
            ->get();

        foreach ($images as $image) {
            $imagePath = $image->getRawOriginal('image_path');
            if ($imagePath && Storage::disk('public')->exists($imagePath)) {
                Storage::disk('public')->delete($imagePath);
            }
            $image->delete();
        }
    }

    protected function syncImageOrder(StoreLocation $storeLocation, array $order, array $createdImages): void
    {
        $position = 0;
        $usedIds = [];
        $createdMap = collect($createdImages)->values();

        foreach ($order as $entry) {
            if (str_starts_with($entry, 'existing:')) {
                $id = (int) str_replace('existing:', '', $entry);
                if ($id <= 0) {
                    continue;
                }
                $image = $storeLocation->images()->where('id', $id)->first();
                if (! $image) {
                    continue;
                }
                $image->update(['sort_order' => $position]);
                $usedIds[] = $image->id;
                $position++;
                continue;
            }

            if (str_starts_with($entry, 'new:')) {
                $index = (int) str_replace('new:', '', $entry);
                $image = $createdMap->get($index);
                if (! $image) {
                    continue;
                }
                $image->update(['sort_order' => $position]);
                $usedIds[] = $image->id;
                $position++;
            }
        }

        $remainingImages = $storeLocation->images()
            ->when(! empty($usedIds), function ($query) use ($usedIds) {
                $query->whereNotIn('id', $usedIds);
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($remainingImages as $image) {
            $image->update(['sort_order' => $position]);
            $position++;
        }
    }
}
