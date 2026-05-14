<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Append one JSON line per failed product create/update for offline diagnosis (CRM saves, server 500, etc.).
 * Files live under storage/logs/LGOS/ (writable on all Laravel installs).
 */
class ProductSaveFailureLogger
{
    public static function log(Request $request, string $stage, ?int $productId, Throwable $e): void
    {
        try {
            $dir = storage_path('logs/LGOS');
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $path = $dir.DIRECTORY_SEPARATOR.'product-save-failures.jsonl';

            $row = [
                'at' => now()->toIso8601String(),
                'stage' => $stage,
                'product_id' => $productId,
                'method' => $request->method(),
                'path' => $request->path(),
                'user_id' => $request->user()?->id,
                'ip' => $request->ip(),
            ];

            if ($e instanceof ValidationException) {
                $row['type'] = 'validation';
                $row['message'] = $e->getMessage();
                $row['errors'] = $e->errors();
            } else {
                $row['type'] = 'exception';
                $row['exception'] = $e::class;
                $row['message'] = $e->getMessage();
                $row['trace'] = mb_substr($e->getTraceAsString(), 0, 12000);
            }

            $input = $request->except(['variant_images', 'images', 'meta_og_image_file']);
            $encoded = json_encode($input, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            $row['input_preview'] = $encoded !== false
                ? (strlen($encoded) > 50000 ? substr($encoded, 0, 50000).'…[truncated]' : $encoded)
                : null;

            File::append($path, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n");
        } catch (Throwable) {
            // Never break the main request because logging failed.
        }
    }
}
