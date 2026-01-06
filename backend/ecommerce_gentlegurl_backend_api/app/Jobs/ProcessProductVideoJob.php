<?php

namespace App\Jobs;

use App\Models\Ecommerce\ProductMedia;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessProductVideoJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(protected int $mediaId)
    {
    }

    public function handle(): void
    {
        $media = ProductMedia::find($this->mediaId);
        if (! $media || $media->type !== 'video') {
            return;
        }

        $disk = $media->disk ?? 'public';
        $sourcePath = Storage::disk($disk)->path($media->path);

        if (! file_exists($sourcePath)) {
            $media->update(['status' => 'failed']);
            return;
        }

        $probe = $this->probeVideo($sourcePath);
        if ($probe) {
            $media->fill([
                'width' => $probe['width'] ?? null,
                'height' => $probe['height'] ?? null,
                'duration_seconds' => $probe['duration'] ?? null,
            ]);

            if (! $this->withinLimits($probe)) {
                $media->update(['status' => 'failed']);
                Storage::disk($disk)->delete($media->getRawOriginal('path'));
                return;
            }
        }

        if (! $this->isFfmpegAvailable()) {
            $extension = pathinfo($media->path, PATHINFO_EXTENSION) ?: 'mp4';
            $fallbackPath = sprintf('products/%s/video/%s.%s', $media->product_id, Str::uuid(), $extension);
            Storage::disk($disk)->makeDirectory(dirname($fallbackPath));
            Storage::disk($disk)->move($media->path, $fallbackPath);
            $media->path = $fallbackPath;
            $media->status = 'ready';
            $media->size_bytes = Storage::disk($disk)->size($fallbackPath);
            $media->save();
            return;
        }

        $uuid = Str::uuid();
        $originalPath = $media->getRawOriginal('path');
        $outputPath = sprintf('products/%s/video/%s.mp4', $media->product_id, $uuid);
        $thumbnailPath = sprintf('products/%s/video/thumb_%s.jpg', $media->product_id, $uuid);

        Storage::disk($disk)->makeDirectory(dirname($outputPath));

        $outputFullPath = Storage::disk($disk)->path($outputPath);

        $process = Process::run([
            'ffmpeg',
            '-y',
            '-i',
            $sourcePath,
            '-c:v',
            'libx264',
            '-profile:v',
            'main',
            '-preset',
            'medium',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            $outputFullPath,
        ]);

        if (! $process->successful()) {
            $media->update(['status' => 'failed']);
            return;
        }

        $thumbnailFullPath = Storage::disk($disk)->path($thumbnailPath);
        $thumbnailProcess = Process::run([
            'ffmpeg',
            '-y',
            '-i',
            $outputFullPath,
            '-ss',
            '00:00:01.000',
            '-vframes',
            '1',
            $thumbnailFullPath,
        ]);

        if ($thumbnailProcess->successful()) {
            $media->thumbnail_path = $thumbnailPath;
        }

        $sizeBytes = file_exists($outputFullPath) ? filesize($outputFullPath) : $media->size_bytes;
        $media->path = $outputPath;
        $media->mime_type = 'video/mp4';
        $media->size_bytes = $sizeBytes ?: $media->size_bytes;
        $media->status = 'ready';
        $media->save();

        if ($originalPath) {
            Storage::disk($disk)->delete($originalPath);
        }
    }

    protected function isFfmpegAvailable(): bool
    {
        $process = Process::run(['ffmpeg', '-version']);

        return $process->successful();
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

    protected function withinLimits(array $probe): bool
    {
        $maxSeconds = (int) config('ecommerce.product_media.video_max_seconds');
        $maxWidth = (int) config('ecommerce.product_media.video_max_width');
        $maxHeight = (int) config('ecommerce.product_media.video_max_height');

        if (isset($probe['duration']) && $probe['duration'] > $maxSeconds) {
            return false;
        }

        if (isset($probe['width']) && $probe['width'] > $maxWidth) {
            return false;
        }

        if (isset($probe['height']) && $probe['height'] > $maxHeight) {
            return false;
        }

        return true;
    }
}
