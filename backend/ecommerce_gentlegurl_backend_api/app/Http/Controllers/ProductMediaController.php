<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessProductVideoJob;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductMediaController extends Controller
{
    public function store(Request $request, Product $product)
    {
        $type = $request->input('type');
        $imageMaxKilobytes = (int) config('ecommerce.product_media.image_max_mb') * 1024;
        $videoMaxKilobytes = (int) config('ecommerce.product_media.video_max_mb') * 1024;
        $imageExtensions = implode(',', config('ecommerce.product_media.image_extensions'));
        $videoExtensions = implode(',', config('ecommerce.product_media.video_extensions'));

        $validated = $request->validate([
            'type' => ['required', Rule::in(['image', 'video'])],
            'file' => [
                'required',
                'file',
                $type === 'image' ? "mimes:{$imageExtensions}" : "mimes:{$videoExtensions}",
                $type === 'image' ? "max:{$imageMaxKilobytes}" : "max:{$videoMaxKilobytes}",
            ],
        ]);

        $file = $request->file('file');
        if (! $file) {
            throw ValidationException::withMessages([
                'file' => __('File is required.'),
            ]);
        }

        if ($validated['type'] === 'video') {
            if (! config('ecommerce.product_media.video_enabled')) {
                throw ValidationException::withMessages([
                    'file' => __('Video upload is disabled.'),
                ]);
            }

            $hasVideo = $product->media()->where('type', 'video')->exists();
            if ($hasVideo) {
                throw ValidationException::withMessages([
                    'file' => __('Only one video is allowed per product.'),
                ]);
            }

            $mimeType = $file->getMimeType();
            if ($mimeType && ! in_array($mimeType, config('ecommerce.product_media.video_mime_types'), true)) {
                throw ValidationException::withMessages([
                    'file' => __('Invalid video format.'),
                ]);
            }

            $probe = $this->probeVideo($file->getPathname());
            if ($probe) {
                $this->validateVideoMetadata($probe);
            } elseif (! app()->environment('local')) {
                throw ValidationException::withMessages([
                    'file' => __('Unable to validate video metadata.'),
                ]);
            }

            $filename = sprintf(
                'products/%s/video/tmp/%s.%s',
                $product->id,
                Str::uuid(),
                $file->getClientOriginalExtension()
            );

            $path = $file->storeAs('', $filename, 'public');

            $media = ProductMedia::create([
                'product_id' => $product->id,
                'type' => 'video',
                'disk' => 'public',
                'path' => $path,
                'thumbnail_path' => null,
                'sort_order' => 0,
                'mime_type' => $mimeType ?? 'video/mp4',
                'size_bytes' => $file->getSize() ?? 0,
                'width' => $probe['width'] ?? null,
                'height' => $probe['height'] ?? null,
                'duration_seconds' => $probe['duration'] ?? null,
                'status' => 'processing',
            ]);

            ProcessProductVideoJob::dispatch($media->id);

            return $this->respond($media, __('Video uploaded successfully.'));
        }

        $mimeType = $file->getMimeType();
        if ($mimeType && ! in_array($mimeType, config('ecommerce.product_media.image_mime_types'), true)) {
            throw ValidationException::withMessages([
                'file' => __('Invalid image format.'),
            ]);
        }

        $filename = sprintf(
            'products/%s/images/%s.%s',
            $product->id,
            Str::uuid(),
            $file->getClientOriginalExtension()
        );

        $path = $file->storeAs('', $filename, 'public');

        $sortOrder = $product->media()->where('type', 'image')->count();

        $media = ProductMedia::create([
            'product_id' => $product->id,
            'type' => 'image',
            'disk' => 'public',
            'path' => $path,
            'thumbnail_path' => null,
            'sort_order' => $sortOrder,
            'mime_type' => $mimeType ?? 'image/jpeg',
            'size_bytes' => $file->getSize() ?? 0,
            'status' => 'ready',
        ]);

        return $this->respond($media, __('Image uploaded successfully.'));
    }

    public function destroy(Product $product, ProductMedia $media)
    {
        if ($media->product_id !== $product->id) {
            abort(404);
        }

        $path = $media->getRawOriginal('path');
        if ($path && Storage::disk($media->disk)->exists($path)) {
            Storage::disk($media->disk)->delete($path);
        }

        $thumbnailPath = $media->getRawOriginal('thumbnail_path');
        if ($thumbnailPath && Storage::disk($media->disk)->exists($thumbnailPath)) {
            Storage::disk($media->disk)->delete($thumbnailPath);
        }

        $media->delete();

        return $this->respond(null, __('Media deleted successfully.'));
    }

    public function reorder(Request $request, Product $product)
    {
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'integer', 'exists:product_media,id'],
            'items.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        $ids = collect($validated['items'])->pluck('id')->all();
        $mediaItems = ProductMedia::query()
            ->where('product_id', $product->id)
            ->where('type', 'image')
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        foreach ($validated['items'] as $item) {
            $media = $mediaItems->get($item['id']);
            if (! $media) {
                continue;
            }
            $media->sort_order = $item['sort_order'];
            $media->save();
        }

        return $this->respond($product->load(['images', 'video']), __('Media order updated successfully.'));
    }

    protected function probeVideo(string $path): ?array
    {
        $process = Process::run([
            'ffprobe',
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height,duration',
            '-of',
            'json',
            $path,
        ]);

        if (! $process->successful()) {
            return null;
        }

        $payload = json_decode($process->output(), true);
        $stream = $payload['streams'][0] ?? null;

        if (! $stream) {
            return null;
        }

        return [
            'width' => isset($stream['width']) ? (int) $stream['width'] : null,
            'height' => isset($stream['height']) ? (int) $stream['height'] : null,
            'duration' => isset($stream['duration']) ? (float) $stream['duration'] : null,
        ];
    }

    protected function validateVideoMetadata(array $probe): void
    {
        $maxSeconds = (int) config('ecommerce.product_media.video_max_seconds');
        $maxWidth = (int) config('ecommerce.product_media.video_max_width');
        $maxHeight = (int) config('ecommerce.product_media.video_max_height');

        if (isset($probe['duration']) && $probe['duration'] > $maxSeconds) {
            throw ValidationException::withMessages([
                'file' => __('Video duration exceeds the maximum allowed length.'),
            ]);
        }

        if (isset($probe['width']) && $probe['width'] > $maxWidth) {
            throw ValidationException::withMessages([
                'file' => __('Video width exceeds the maximum allowed width.'),
            ]);
        }

        if (isset($probe['height']) && $probe['height'] > $maxHeight) {
            throw ValidationException::withMessages([
                'file' => __('Video height exceeds the maximum allowed height.'),
            ]);
        }
    }
}
