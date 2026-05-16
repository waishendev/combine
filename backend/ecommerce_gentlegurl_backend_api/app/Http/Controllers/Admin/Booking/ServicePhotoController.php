<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingServicePhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ServicePhotoController extends Controller
{
    public function index(Booking $booking)
    {
        return $this->respond([
            'service_photos' => $this->mapPhotos($booking->servicePhotos()->get())->values(),
        ]);
    }

    public function store(Request $request, Booking $booking)
    {
        $validated = $request->validate([
            'photos' => ['required', 'array', 'min:1', 'max:12'],
            'photos.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'captions' => ['nullable', 'array'],
            'captions.*' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $sortOrder = BookingServicePhoto::query()->where('booking_id', (int) $booking->id)->max('sort_order');
        $nextSort = is_numeric($sortOrder) ? ((int) $sortOrder + 1) : 0;
        $captions = is_array($request->input('captions')) ? $request->input('captions') : [];
        $fallbackCaption = trim((string) ($validated['caption'] ?? ''));

        foreach ($validated['photos'] as $index => $photo) {
            $ext = strtolower((string) $photo->getClientOriginalExtension()) ?: 'jpg';
            $filename = sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $ext);
            $path = $photo->storeAs('booking/service-photos', $filename, 'public');
            $caption = trim((string) ($captions[$index] ?? $fallbackCaption));

            BookingServicePhoto::query()->create([
                'booking_id' => (int) $booking->id,
                'image_path' => $path,
                'caption' => $caption !== '' ? $caption : null,
                'uploaded_by' => $request->user()?->id,
                'sort_order' => $nextSort++,
            ]);
        }

        return $this->respond([
            'service_photos' => $this->mapPhotos($booking->fresh('servicePhotos')->servicePhotos)->values(),
        ]);
    }

    public function destroy(Booking $booking, BookingServicePhoto $photo)
    {
        if ((int) $photo->booking_id !== (int) $booking->id) {
            return $this->respondError('Service photo not found.', 404);
        }

        if ($photo->image_path && Storage::disk('public')->exists($photo->image_path)) {
            Storage::disk('public')->delete($photo->image_path);
        }
        $photo->delete();

        return $this->respond([
            'service_photos' => $this->mapPhotos($booking->fresh('servicePhotos')->servicePhotos)->values(),
        ]);
    }

    private function mapPhotos($photos)
    {
        return collect($photos)->map(fn (BookingServicePhoto $photo) => [
            'id' => (int) $photo->id,
            'booking_id' => (int) $photo->booking_id,
            'image_path' => (string) $photo->image_path,
            'image_url' => $photo->image_url,
            'caption' => $photo->caption,
            'uploaded_by' => $photo->uploaded_by ? (int) $photo->uploaded_by : null,
            'sort_order' => (int) ($photo->sort_order ?? 0),
            'created_at' => $photo->created_at?->toIso8601String(),
            'updated_at' => $photo->updated_at?->toIso8601String(),
        ]);
    }
}
