<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        $categories = BookingServiceCategory::query()
            ->with('services:id,name')
            ->when($request->filled('name'), fn ($query) => $query->where('name', 'like', '%' . $request->string('name') . '%'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        $categories->getCollection()->transform(fn (BookingServiceCategory $category) => $this->formatCategory($category));

        return $this->respond($categories);
    }

    public function show(int $id)
    {
        $category = BookingServiceCategory::query()->with('services:id,name')->findOrFail($id);

        return $this->respond($this->formatCategory($category));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug'],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', 'exists:booking_services,id'],
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $data['sort_order'] = ((int) BookingServiceCategory::query()->max('sort_order')) + 1;
        $serviceIds = array_values(array_unique(array_map('intval', $data['service_ids'] ?? [])));
        unset($data['service_ids']);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/category-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $category = BookingServiceCategory::query()->create($data);
        $category->services()->sync(BookingService::query()->whereIn('id', $serviceIds)->pluck('id')->all());

        return $this->respond($this->formatCategory($category->fresh('services:id,name')), 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'unique:booking_service_categories,slug,' . $category->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', 'exists:booking_services,id'],
        ]);

        $oldImagePath = $category->image_path;
        if (! isset($data['slug']) && isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
        }

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->storeAs(
                'booking/category-images',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('image')->getClientOriginalExtension()),
                'public'
            );
        }

        $serviceIds = null;
        if (array_key_exists('service_ids', $data)) {
            $serviceIds = array_values(array_unique(array_map('intval', $data['service_ids'] ?? [])));
            unset($data['service_ids']);
        }

        $category->update($data);

        if ($serviceIds !== null) {
            $category->services()->sync(BookingService::query()->whereIn('id', $serviceIds)->pluck('id')->all());
        }

        if (isset($data['image_path']) && $oldImagePath && $oldImagePath !== $data['image_path'] && Storage::disk('public')->exists($oldImagePath)) {
            Storage::disk('public')->delete($oldImagePath);
        }

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
    }

    public function destroy(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $category->delete();

        return $this->respond(null);
    }

    public function moveUp(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $swap = BookingServiceCategory::query()
            ->where('sort_order', '<', $category->sort_order)
            ->orderByDesc('sort_order')
            ->first();

        if ($swap) {
            $original = $category->sort_order;
            $category->update(['sort_order' => $swap->sort_order]);
            $swap->update(['sort_order' => $original]);
        }

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
    }

    public function moveDown(int $id)
    {
        $category = BookingServiceCategory::query()->findOrFail($id);
        $swap = BookingServiceCategory::query()
            ->where('sort_order', '>', $category->sort_order)
            ->orderBy('sort_order')
            ->first();

        if ($swap) {
            $original = $category->sort_order;
            $category->update(['sort_order' => $swap->sort_order]);
            $swap->update(['sort_order' => $original]);
        }

        return $this->respond($this->formatCategory($category->fresh('services:id,name')));
    }

    private function formatCategory(BookingServiceCategory $category): array
    {
        $services = $category->services
            ->sortBy('name')
            ->values()
            ->map(fn (BookingService $service) => [
                'id' => (int) $service->id,
                'name' => $service->name,
            ])->all();

        return [
            'id' => (int) $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image_path' => $category->image_path,
            'image_url' => $category->image_url,
            'is_active' => (bool) $category->is_active,
            'sort_order' => (int) $category->sort_order,
            'services' => $services,
            'service_ids' => array_map(fn (array $item) => (int) $item['id'], $services),
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
        ];
    }
}
