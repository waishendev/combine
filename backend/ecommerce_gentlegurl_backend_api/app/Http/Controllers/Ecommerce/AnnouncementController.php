<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $query = Announcement::query();

        if ($request->filled('key')) {
            $query->where('key', $request->get('key'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('current_only', false)) {
            $query->current();
        }

        $announcements = $query
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate($request->get('per_page', 20));

        return $this->respond($announcements);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'key' => 'nullable|string|max:50',
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:255',
            'body_text' => 'nullable|string',
            'image_path' => 'nullable|string|max:255',
            'image_file' => 'nullable|image|mimes:jpeg,jpg,png,gif,webp|max:5120', // 最大 5MB
            'button_label' => 'nullable|string|max:100',
            'button_link' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'show_once_per_session' => 'boolean',
        ]);

        // Automatically set sort_order to the next available value
        $sortOrder = (Announcement::max('sort_order') ?? 0) + 1;
        $data['sort_order'] = $sortOrder;

        // Handle image file upload
        if ($request->hasFile('image_file')) {
            $file = $request->file('image_file');
            $filename = 'announcements/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('', $filename, 'public');
            $data['image_path'] = $path;
        }

        // Remove image_file from data array as it's not a database field
        unset($data['image_file']);

        $announcement = Announcement::create($data);

        return $this->respond($announcement, __('Announcement created successfully.'), true, 201);
    }

    public function show(Announcement $announcement)
    {
        return $this->respond($announcement);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $data = $request->validate([
            'key' => 'sometimes|nullable|string|max:50',
            'title' => 'sometimes|nullable|string|max:255',
            'subtitle' => 'sometimes|nullable|string|max:255',
            'body_text' => 'sometimes|nullable|string',
            'image_path' => 'sometimes|nullable|string|max:255',
            'image_file' => 'sometimes|nullable|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'button_label' => 'sometimes|nullable|string|max:100',
            'button_link' => 'sometimes|nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
            'start_at' => 'sometimes|nullable|date',
            'end_at' => 'sometimes|nullable|date|after_or_equal:start_at',
            'show_once_per_session' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        // Handle image file upload (nullable for update)
        if ($request->hasFile('image_file')) {
            // Delete old image if it was stored locally
            if ($announcement->image_path && str_starts_with($announcement->image_path, 'announcements/') && Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }

            $file = $request->file('image_file');
            $filename = 'announcements/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $data['image_path'] = $file->storeAs('', $filename, 'public');
        } elseif ($request->has('image_path')) {
            // Explicitly updating/removing image_path
            $imagePath = $request->input('image_path');
            if (empty($imagePath) && $announcement->image_path && str_starts_with($announcement->image_path, 'announcements/') && Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }
            $data['image_path'] = $imagePath;
        }

        unset($data['image_file']);

        $announcement->update($data);

        return $this->respond($announcement->fresh(), __('Announcement updated successfully.'));
    }

    public function destroy(Announcement $announcement)
    {
        // Delete image file if it exists and was uploaded
        if ($announcement->image_path && str_starts_with($announcement->image_path, 'announcements/')) {
            if (Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }
        }

        $announcement->delete();

        return $this->respond(null, __('Announcement deleted successfully.'));
    }

    public function moveUp(Announcement $announcement)
    {
        return DB::transaction(function () use ($announcement) {
            $oldPosition = $announcement->sort_order;

            // Find the previous announcement (lower sort_order)
            $previousAnnouncement = Announcement::where('sort_order', '<', $announcement->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousAnnouncement) {
                // Already at the top
                return $this->respond(null, __('Announcement is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousAnnouncement->sort_order;

            $announcement->sort_order = $newPosition;
            $announcement->save();

            $previousAnnouncement->sort_order = $oldPosition;
            $previousAnnouncement->save();

            // Return metadata only
            return $this->respond([
                'id' => $announcement->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Announcement moved up successfully.'));
        });
    }

    public function moveDown(Announcement $announcement)
    {
        return DB::transaction(function () use ($announcement) {
            $oldPosition = $announcement->sort_order;

            // Find the next announcement (higher sort_order)
            $nextAnnouncement = Announcement::where('sort_order', '>', $announcement->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextAnnouncement) {
                // Already at the bottom
                return $this->respond(null, __('Announcement is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextAnnouncement->sort_order;

            $announcement->sort_order = $newPosition;
            $announcement->save();

            $nextAnnouncement->sort_order = $oldPosition;
            $nextAnnouncement->save();

            // Return metadata only
            return $this->respond([
                'id' => $announcement->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Announcement moved down successfully.'));
        });
    }
}
