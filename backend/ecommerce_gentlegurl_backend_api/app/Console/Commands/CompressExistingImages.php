<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CompressExistingImages extends Command
{
    protected $signature = 'images:compress
        {--dir= : Compress only a specific directory (e.g. products, sliders)}
        {--max-width=1920 : Maximum image width in pixels}
        {--max-height=1920 : Maximum image height in pixels}
        {--quality=82 : JPEG compression quality (1-100)}
        {--dry-run : Preview changes without modifying files}
        {--min-size=500 : Only compress files larger than this size in KB}';

    protected $description = 'Batch-compress existing images in storage/app/public using PHP GD library.';

    private array $directories = [
        'products',
        'booking-products',
        'booking-services',
        'sliders',
        'announcements',
        'booking-landing',
    ];

    private array $supportedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

    private int $processed = 0;
    private int $skipped = 0;
    private int $errors = 0;
    private int $totalSaved = 0;

    public function handle(): int
    {
        $targetDir = $this->option('dir');
        $maxWidth = (int) $this->option('max-width');
        $maxHeight = (int) $this->option('max-height');
        $quality = (int) $this->option('quality');
        $dryRun = $this->option('dry-run');
        $minSizeKB = (int) $this->option('min-size');

        if ($quality < 1 || $quality > 100) {
            $this->error('Quality must be between 1 and 100.');
            return Command::FAILURE;
        }

        $directories = $targetDir
            ? [$targetDir]
            : $this->directories;

        foreach ($directories as $dir) {
            if (! $this->validateDirectory($dir)) {
                continue;
            }
        }

        if ($dryRun) {
            $this->warn('DRY RUN MODE - no files will be modified.');
        }

        $this->info("Settings: max {$maxWidth}x{$maxHeight}, quality {$quality}, min size {$minSizeKB}KB");
        $this->newLine();

        foreach ($directories as $dir) {
            $this->processDirectory($dir, $maxWidth, $maxHeight, $quality, $dryRun, $minSizeKB);
        }

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->info("Processed: {$this->processed}");
        $this->info("Skipped:   {$this->skipped}");
        $this->info("Errors:    {$this->errors}");
        $this->info("Saved:     " . $this->formatBytes($this->totalSaved));

        return Command::SUCCESS;
    }

    private function validateDirectory(string $dir): bool
    {
        $path = storage_path("app/public/{$dir}");

        if (! is_dir($path)) {
            $this->warn("Directory not found: {$path} — skipping.");
            return false;
        }

        return true;
    }

    private function processDirectory(string $dir, int $maxWidth, int $maxHeight, int $quality, bool $dryRun, int $minSizeKB): void
    {
        $basePath = storage_path("app/public/{$dir}");

        if (! is_dir($basePath)) {
            return;
        }

        $files = $this->getImageFiles($basePath);
        $count = count($files);

        $this->info("📁 {$dir}/ — {$count} image(s) found");

        if ($count === 0) {
            return;
        }

        $bar = $this->output->createProgressBar($count);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% %message%');
        $bar->setMessage('');
        $bar->start();

        foreach ($files as $file) {
            $bar->setMessage(basename($file));

            try {
                $this->processFile($file, $maxWidth, $maxHeight, $quality, $dryRun, $minSizeKB);
            } catch (\Throwable $e) {
                $this->errors++;
                $bar->setMessage('ERROR: ' . basename($file));
                $this->logError($file, $e->getMessage());
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
    }

    private function getImageFiles(string $directory): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (! $file->isFile()) {
                continue;
            }

            $ext = strtolower($file->getExtension());
            if (in_array($ext, $this->supportedExtensions)) {
                $files[] = $file->getRealPath();
            }
        }

        sort($files);
        return $files;
    }

    private function processFile(string $filePath, int $maxWidth, int $maxHeight, int $quality, bool $dryRun, int $minSizeKB): void
    {
        $originalSize = filesize($filePath);

        if ($originalSize === false || $originalSize < $minSizeKB * 1024) {
            $this->skipped++;
            return;
        }

        $imageInfo = @\getimagesize($filePath);
        if ($imageInfo === false) {
            $this->skipped++;
            return;
        }

        [$origWidth, $origHeight] = $imageInfo;
        $mimeType = $imageInfo['mime'];

        $hasTransparency = $this->imageHasTransparency($filePath, $mimeType);

        $newWidth = $origWidth;
        $newHeight = $origHeight;
        $needsResize = false;

        if ($origWidth > $maxWidth || $origHeight > $maxHeight) {
            $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight);
            $newWidth = (int) round($origWidth * $ratio);
            $newHeight = (int) round($origHeight * $ratio);
            $needsResize = true;
        }

        if (! $needsResize && $mimeType === 'image/png' && $hasTransparency) {
            $this->skipped++;
            return;
        }

        if ($dryRun) {
            $this->processed++;
            $action = $needsResize ? "resize to {$newWidth}x{$newHeight}" : 'recompress';
            $this->line("  [DRY] {$filePath} ({$this->formatBytes($originalSize)}) — would {$action}");
            return;
        }

        $source = $this->loadImage($filePath, $mimeType);
        if ($source === null) {
            $this->errors++;
            return;
        }

        if ($needsResize) {
            $resized = \imagecreatetruecolor($newWidth, $newHeight);

            if ($hasTransparency) {
                \imagealphablending($resized, false);
                \imagesavealpha($resized, true);
                $transparent = \imagecolorallocatealpha($resized, 0, 0, 0, 127);
                \imagefill($resized, 0, 0, $transparent);
            }

            \imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
            \imagedestroy($source);
            $source = $resized;
        }

        $tempPath = $filePath . '.tmp';

        $saved = $hasTransparency
            ? $this->saveAsPng($source, $tempPath)
            : $this->saveAsJpeg($source, $tempPath, $quality);

        \imagedestroy($source);

        if (! $saved) {
            @unlink($tempPath);
            $this->errors++;
            return;
        }

        $newSize = filesize($tempPath);

        if ($newSize >= $originalSize) {
            @unlink($tempPath);
            $this->skipped++;
            return;
        }

        if (! rename($tempPath, $filePath)) {
            @unlink($tempPath);
            $this->errors++;
            $this->logError($filePath, 'Failed to replace original file.');
            return;
        }

        $saved = $originalSize - $newSize;
        $this->totalSaved += $saved;
        $this->processed++;
    }

    private function loadImage(string $path, string $mimeType): ?\GdImage
    {
        return match ($mimeType) {
            'image/jpeg' => @\imagecreatefromjpeg($path) ?: null,
            'image/png' => @\imagecreatefrompng($path) ?: null,
            'image/webp' => @\imagecreatefromwebp($path) ?: null,
            default => null,
        };
    }

    private function saveAsJpeg(\GdImage $image, string $path, int $quality): bool
    {
        return @\imagejpeg($image, $path, $quality);
    }

    private function saveAsPng(\GdImage $image, string $path): bool
    {
        \imagesavealpha($image, true);
        return @\imagepng($image, $path, 6);
    }

    private function imageHasTransparency(string $filePath, string $mimeType): bool
    {
        if ($mimeType === 'image/jpeg') {
            return false;
        }

        if ($mimeType === 'image/png') {
            $info = @\getimagesize($filePath);
            if ($info && isset($info['channels']) && $info['channels'] === 3) {
                return false;
            }

            $image = @\imagecreatefrompng($filePath);
            if (! $image) {
                return false;
            }

            $hasAlpha = $this->checkAlphaChannel($image);
            \imagedestroy($image);
            return $hasAlpha;
        }

        if ($mimeType === 'image/webp') {
            return true;
        }

        return false;
    }

    private function checkAlphaChannel(\GdImage $image): bool
    {
        $width = \imagesx($image);
        $height = \imagesy($image);

        $step = max(1, (int) ($width * $height / 1000));
        $pixelCount = $width * $height;

        for ($i = 0; $i < $pixelCount; $i += $step) {
            $x = $i % $width;
            $y = (int) ($i / $width);
            $rgba = \imagecolorat($image, $x, $y);
            $alpha = ($rgba >> 24) & 0x7F;
            if ($alpha > 0) {
                return true;
            }
        }

        return false;
    }

    private function logError(string $file, string $message): void
    {
        $this->newLine();
        $this->error("  ERROR [{$file}]: {$message}");
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return number_format($bytes / 1073741824, 2) . ' GB';
        }
        if ($bytes >= 1048576) {
            return number_format($bytes / 1048576, 2) . ' MB';
        }
        if ($bytes >= 1024) {
            return number_format($bytes / 1024, 2) . ' KB';
        }
        return $bytes . ' B';
    }
}
