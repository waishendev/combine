<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
use App\Models\Setting;
use App\Http\Requests\StoreLocation\StoreStoreLocationRequest;
use App\Http\Requests\StoreLocation\UpdateStoreLocationRequest;
use App\Services\BranchCapacityService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class StoreLocationController extends Controller
{
    public function index(Request $request)
    {
        // NEW ENHANCEMENT — membership-loyalty-store-query-v1
        $perPage = $request->integer('per_page', 15);
        $hasFilters = $request->filled('name')
            || $request->filled('code')
            || $request->filled('city')
            || $request->has('is_active');

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
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($perPage);

        $this->attachCoverImages($locations->getCollection());

        // Capacity count must stay unfiltered; reuse paginator total when no filters.
        $branchUsage = $hasFilters
            ? app(BranchCapacityService::class)->usage()
            : app(BranchCapacityService::class)->usage((int) $locations->total());

        return response()->json([
            'data' => $locations,
            'branch_usage' => $branchUsage,
            'message' => null,
            'success' => true,
        ]);
    }

    public function store(StoreStoreLocationRequest $request)
    {
        $validated = $request->validated();

        if ($request->hasFile('images') && count($request->file('images')) > 6) {
            return $this->respond(null, __('A maximum of 6 images is allowed.'), false, 422);
        }

        $location = DB::transaction(function () use ($validated) {
            $setting = Setting::firstOrCreate(
                ['type' => 'ecommerce', 'key' => BranchCapacityService::SETTING_KEY],
                ['value' => BranchCapacityService::DEFAULT_LIMIT]
            );
            $setting->newQuery()->whereKey($setting->id)->lockForUpdate()->first();

            $capacity = app(BranchCapacityService::class)->usage();
            if (! $capacity['can_create']) {
                throw ValidationException::withMessages([
                    'branch_limit' => [__('The branch limit has been reached. Inactive branches count toward the limit.')],
                ]);
            }

            return StoreLocation::create($validated + [
                'is_active' => $validated['is_active'] ?? true,
                'is_pickup_available' => $validated['is_pickup_available'] ?? true,
                'is_review_available' => $validated['is_review_available'] ?? true,
                'is_booking_available' => $validated['is_booking_available'] ?? false,
                'is_pos_available' => $validated['is_pos_available'] ?? false,
                'sort_order' => $validated['sort_order'] ?? 0,
            ]);
        });

        if ($request->hasFile('images')) {
            $this->handleImageUploads($location, $request->file('images'));
        }

        return $this->respond($location->load('images'), __('Branch created successfully.'));
    }

    public function show(StoreLocation $storeLocation)
    {
        return $this->respond($storeLocation->load('images'));
    }

    public function update(UpdateStoreLocationRequest $request, StoreLocation $storeLocation)
    {
        $validated = $request->validated();
        unset($validated['id'], $validated['code']);

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

        return $this->respond($storeLocation->load('images'), __('Branch updated successfully.'));
    }

    public function destroy(StoreLocation $storeLocation)
    {
        return $this->respondError(
            __('Branches cannot be deleted. Deactivate the branch instead.'),
            422
        );
    }

    /**
     * List only needs the first image (thumbnail). Keep `images` array shape (0–1 items).
     */
    protected function attachCoverImages($locations): void
    {
        $ids = $locations->pluck('id')->all();
        if ($ids === []) {
            $locations->each(fn (StoreLocation $location) => $location->setRelation('images', collect()));

            return;
        }

        $covers = collect();
        if (DB::getDriverName() === 'pgsql') {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $rows = DB::select(
                "SELECT DISTINCT ON (store_location_id) id, store_location_id, image_path, sort_order, created_at, updated_at
                 FROM store_location_images
                 WHERE store_location_id IN ({$placeholders})
                 ORDER BY store_location_id, sort_order ASC, id ASC",
                $ids
            );
            foreach ($rows as $row) {
                $image = new StoreLocationImage([
                    'store_location_id' => $row->store_location_id,
                    'image_path' => $row->image_path,
                    'sort_order' => $row->sort_order,
                ]);
                $image->id = $row->id;
                $image->exists = true;
                if (isset($row->created_at)) {
                    $image->created_at = $row->created_at;
                }
                if (isset($row->updated_at)) {
                    $image->updated_at = $row->updated_at;
                }
                $covers->put((int) $row->store_location_id, $image);
            }
        } else {
            $covers = StoreLocationImage::query()
                ->whereIn('store_location_id', $ids)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->groupBy('store_location_id')
                ->map(fn ($rows) => $rows->first());
        }

        $locations->each(function (StoreLocation $location) use ($covers) {
            $cover = $covers->get((int) $location->id);
            $location->setRelation('images', $cover ? collect([$cover]) : collect());
        });
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
