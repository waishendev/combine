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
        $type = $this->resolveType($request);
        $query = Announcement::query()->ofType($type);

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
            'type' => 'nullable|string|in:ecommerce,booking',
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:255',
            'body_text' => 'nullable|string',
            'image_path' => 'nullable|string|max:255',
            'image_file' => 'nullable|image|mimes:jpeg,jpg,png,gif,webp|max:5120',
            'button_label' => 'nullable|string|max:100',
            'button_link' => 'nullable|string|max:255',
            'is_active' => 'boolean',
            'start_at' => 'nullable|date',
            'end_at' => 'nullable|date|after_or_equal:start_at',
            'show_once_per_session' => 'boolean',
        ]);

        $type = $data['type'] ?? $this->resolveType($request);
        $data['type'] = $type;

        $data['sort_order'] = (Announcement::query()->ofType($type)->max('sort_order') ?? 0) + 1;

        if ($request->hasFile('image_file')) {
            $file = $request->file('image_file');
            $filename = 'announcements/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $data['image_path'] = $file->storeAs('', $filename, 'public');
        }

        unset($data['image_file']);

        $announcement = Announcement::create($data);

        return $this->respond($announcement, __('Announcement created successfully.'), true, 201);
    }

    public function show(Request $request, Announcement $announcement)
    {
        $this->assertTypeMatch($request, $announcement);

        return $this->respond($announcement);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $this->assertTypeMatch($request, $announcement);

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

        if ($request->hasFile('image_file')) {
            if ($announcement->image_path && str_starts_with($announcement->image_path, 'announcements/') && Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }

            $file = $request->file('image_file');
            $filename = 'announcements/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $data['image_path'] = $file->storeAs('', $filename, 'public');
        } elseif ($request->has('image_path')) {
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

    public function destroy(Request $request, Announcement $announcement)
    {
        $this->assertTypeMatch($request, $announcement);

        if ($announcement->image_path && str_starts_with($announcement->image_path, 'announcements/')) {
            if (Storage::disk('public')->exists($announcement->image_path)) {
                Storage::disk('public')->delete($announcement->image_path);
            }
        }

        $announcement->delete();

        return $this->respond(null, __('Announcement deleted successfully.'));
    }

    public function moveUp(Request $request, Announcement $announcement)
    {
        $this->assertTypeMatch($request, $announcement);

        return DB::transaction(function () use ($announcement) {
            $oldPosition = $announcement->sort_order;

            $previousAnnouncement = Announcement::query()
                ->ofType($announcement->type)
                ->where('sort_order', '<', $announcement->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousAnnouncement) {
                return $this->respond(null, __('Announcement is already at the top.'), false, 400);
            }

            $newPosition = $previousAnnouncement->sort_order;

            $announcement->sort_order = $newPosition;
            $announcement->save();

            $previousAnnouncement->sort_order = $oldPosition;
            $previousAnnouncement->save();

            return $this->respond([
                'id' => $announcement->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Announcement moved up successfully.'));
        });
    }

    public function moveDown(Request $request, Announcement $announcement)
    {
        $this->assertTypeMatch($request, $announcement);

        return DB::transaction(function () use ($announcement) {
            $oldPosition = $announcement->sort_order;

            $nextAnnouncement = Announcement::query()
                ->ofType($announcement->type)
                ->where('sort_order', '>', $announcement->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextAnnouncement) {
                return $this->respond(null, __('Announcement is already at the bottom.'), false, 400);
            }

            $newPosition = $nextAnnouncement->sort_order;

            $announcement->sort_order = $newPosition;
            $announcement->save();

            $nextAnnouncement->sort_order = $oldPosition;
            $nextAnnouncement->save();

            return $this->respond([
                'id' => $announcement->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Announcement moved down successfully.'));
        });
    }

    private function resolveType(Request $request): string
    {
        $type = $request->get('type');

        return in_array($type, [Announcement::TYPE_ECOMMERCE, Announcement::TYPE_BOOKING], true)
            ? $type
            : Announcement::TYPE_ECOMMERCE;
    }

    private function assertTypeMatch(Request $request, Announcement $announcement): void
    {
        if ($announcement->type !== $this->resolveType($request)) {
            abort(404);
        }
    }
}
