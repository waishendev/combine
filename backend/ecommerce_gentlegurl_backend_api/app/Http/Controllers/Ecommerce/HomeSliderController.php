<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\HomeSlider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class HomeSliderController extends Controller
{
    public function index(Request $request)
    {
        $query = HomeSlider::query();

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $sliders = $query
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($request->get('per_page', 20));

        return $this->respond($sliders);
    }

    public function store(Request $request)
    {
        // Validate that at least image_path or image_file is provided before validation
        if (!$request->hasFile('image_file') && !$request->has('image_path')) {
            return $this->respond(null, __('Either image_file or image_path is required.'), false, 422);
        }

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'], // 最大 5MB
            'mobile_image_path' => ['nullable', 'string', 'max:255'],
            'mobile_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'], // 最大 5MB
            'button_label' => ['nullable', 'string', 'max:100'],
            'button_link' => ['nullable', 'string', 'max:255'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
        ]);

        // Handle image file upload
        if ($request->hasFile('image_file')) {
            $file = $request->file('image_file');
            $filename = 'sliders/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('', $filename, 'public');
            $data['image_path'] = $path;
        }

        // Handle mobile image file upload
        if ($request->hasFile('mobile_image_file')) {
            $file = $request->file('mobile_image_file');
            $filename = 'sliders/mobile_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('', $filename, 'public');
            $data['mobile_image_path'] = $path;
        }

        // Remove file fields from data array as they're not database fields
        unset($data['image_file'], $data['mobile_image_file']);

        // Automatically set sort_order to the next available value
        $sortOrder = (HomeSlider::max('sort_order') ?? 0) + 1;
        $data['sort_order'] = $sortOrder;
        $data['is_active'] = $data['is_active'] ?? true;

        $slider = HomeSlider::create($data);

        return $this->respond($slider, __('Home slider created successfully.'), true, 201);
    }

    public function show(HomeSlider $slider)
    {
        return $this->respond($slider);
    }

    public function update(Request $request, HomeSlider $slider)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'subtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'image_path' => ['sometimes', 'nullable', 'string', 'max:255'],
            'image_file' => ['sometimes', 'nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'mobile_image_path' => ['sometimes', 'nullable', 'string', 'max:255'],
            'mobile_image_file' => ['sometimes', 'nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'button_label' => ['sometimes', 'nullable', 'string', 'max:100'],
            'button_link' => ['sometimes', 'nullable', 'string', 'max:255'],
            'start_at' => ['sometimes', 'nullable', 'date'],
            'end_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        // Handle image file upload - check hasFile first to ensure file was actually uploaded
        if ($request->hasFile('image_file')) {
            $file = $request->file('image_file');

            if ($slider->image_path && str_starts_with($slider->image_path, 'sliders/') && Storage::disk('public')->exists($slider->image_path)) {
                Storage::disk('public')->delete($slider->image_path);
            }

            $filename = 'sliders/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $data['image_path'] = $file->storeAs('', $filename, 'public');
        } elseif ($request->has('image_path')) {
            $imagePath = $request->input('image_path');
            if (empty($imagePath) && $slider->image_path && str_starts_with($slider->image_path, 'sliders/') && Storage::disk('public')->exists($slider->image_path)) {
                Storage::disk('public')->delete($slider->image_path);
            }
            $data['image_path'] = $imagePath;
        }

        // Handle mobile image file upload - check hasFile first to ensure file was actually uploaded
        if ($request->hasFile('mobile_image_file')) {
            $file = $request->file('mobile_image_file');

            if ($slider->mobile_image_path && str_starts_with($slider->mobile_image_path, 'sliders/') && Storage::disk('public')->exists($slider->mobile_image_path)) {
                Storage::disk('public')->delete($slider->mobile_image_path);
            }

            $filename = 'sliders/mobile_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $data['mobile_image_path'] = $file->storeAs('', $filename, 'public');
        } elseif ($request->has('mobile_image_path')) {
            $mobileImagePath = $request->input('mobile_image_path');
            if (empty($mobileImagePath) && $slider->mobile_image_path && str_starts_with($slider->mobile_image_path, 'sliders/') && Storage::disk('public')->exists($slider->mobile_image_path)) {
                Storage::disk('public')->delete($slider->mobile_image_path);
            }
            $data['mobile_image_path'] = $mobileImagePath;
        }

        // Remove file fields from data array as they're not database fields
        unset($data['image_file'], $data['mobile_image_file']);

        $slider->update($data);

        return $this->respond($slider->fresh(), __('Home slider updated successfully.'));
    }

    public function destroy(HomeSlider $slider)
    {
        // Delete image files if they exist and were uploaded
        if ($slider->image_path && str_starts_with($slider->image_path, 'sliders/')) {
            if (Storage::disk('public')->exists($slider->image_path)) {
                Storage::disk('public')->delete($slider->image_path);
            }
        }

        if ($slider->mobile_image_path && str_starts_with($slider->mobile_image_path, 'sliders/')) {
            if (Storage::disk('public')->exists($slider->mobile_image_path)) {
                Storage::disk('public')->delete($slider->mobile_image_path);
            }
        }

        $slider->delete();

        return $this->respond(null, __('Home slider deleted successfully.'));
    }

    public function moveUp(HomeSlider $slider)
    {
        return DB::transaction(function () use ($slider) {
            $oldPosition = $slider->sort_order;

            // Find the previous slider (lower sort_order)
            $previousSlider = HomeSlider::where('sort_order', '<', $slider->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousSlider) {
                // Already at the top
                return $this->respond(null, __('Home slider is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousSlider->sort_order;

            $slider->sort_order = $newPosition;
            $slider->save();

            $previousSlider->sort_order = $oldPosition;
            $previousSlider->save();

            // Return metadata only
            return $this->respond([
                'id' => $slider->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Home slider moved up successfully.'));
        });
    }

    public function moveDown(HomeSlider $slider)
    {
        return DB::transaction(function () use ($slider) {
            $oldPosition = $slider->sort_order;

            // Find the next slider (higher sort_order)
            $nextSlider = HomeSlider::where('sort_order', '>', $slider->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextSlider) {
                // Already at the bottom
                return $this->respond(null, __('Home slider is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextSlider->sort_order;

            $slider->sort_order = $newPosition;
            $slider->save();

            $nextSlider->sort_order = $oldPosition;
            $nextSlider->save();

            // Return metadata only
            return $this->respond([
                'id' => $slider->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Home slider moved down successfully.'));
        });
    }
}
