<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class BrandingController extends Controller
{
    private const BRANDING_KEY = 'branding';

    public function show(Request $request): JsonResponse
    {
        $type = $this->resolveType($request);
        $branding = SettingService::get(self::BRANDING_KEY, $this->defaultBranding(), $type);

        return response()->json([
            'success' => true,
            'data' => [
                'shop_logo_url' => $this->resolveLogoUrl($branding['shop_logo_path'] ?? null),
                'crm_logo_url' => $this->resolveLogoUrl($branding['crm_logo_path'] ?? null),
                'shop_favicon_url' => $this->resolveLogoUrl($branding['shop_favicon_path'] ?? null),
                'shop_favicon_icons' => $this->resolveIconUrls($branding['shop_favicon_icons'] ?? []),
                'crm_favicon_url' => $this->resolveLogoUrl($branding['crm_favicon_path'] ?? null),
                'crm_favicon_icons' => $this->resolveIconUrls($branding['crm_favicon_icons'] ?? []),
            ],
            'message' => null,
        ]);
    }

    public function uploadShopLogo(Request $request): JsonResponse
    {
        $type = $this->resolveType($request);

        return $this->uploadBrandingFile(
            $request,
            $type,
            'shop_logo_path',
            'shop-logo',
            ['required', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'Logo updated successfully.'
        );
    }

    public function uploadCrmLogo(Request $request): JsonResponse
    {
        $type = $this->resolveType($request);

        return $this->uploadBrandingFile(
            $request,
            $type,
            'crm_logo_path',
            'crm-logo',
            ['required', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'Logo updated successfully.'
        );
    }

    public function uploadShopFavicon(Request $request): JsonResponse
    {
        $type = $this->resolveType($request);

        return $this->uploadBrandingFile(
            $request,
            $type,
            'shop_favicon_path',
            'shop-favicon',
            ['required', 'mimes:jpeg,jpg,png,gif,webp,ico', 'max:5120'],
            'Shop favicon updated successfully.'
        );
    }

    public function uploadCrmFavicon(Request $request): JsonResponse
    {
        $type = $this->resolveType($request);

        return $this->uploadBrandingFile(
            $request,
            $type,
            'crm_favicon_path',
            'crm-favicon',
            ['required', 'mimes:jpeg,jpg,png,gif,webp,ico', 'max:5120'],
            'CRM favicon updated successfully.'
        );
    }

    private function uploadBrandingFile(
        Request $request,
        string $type,
        string $key,
        string $prefix,
        array $rules,
        string $successMessage
    ): JsonResponse
    {
        $validated = $request->validate([
            'logo_file' => $rules,
        ]);

        $branding = SettingService::get(self::BRANDING_KEY, $this->defaultBranding(), $type);
        $existingPath = $branding[$key] ?? null;

        if ($request->hasFile('logo_file')) {
            $file = $request->file('logo_file');
            $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
            $filename = sprintf('%s-%s.%s', $prefix, Str::random(12), $extension);
            $path = $file->storeAs('branding', $filename, 'public');

            if ($existingPath && str_starts_with($existingPath, 'branding/')) {
                if (Storage::disk('public')->exists($existingPath)) {
                    Storage::disk('public')->delete($existingPath);
                }
            }

            $iconKey = $this->iconKeyFor($key);
            if ($iconKey) {
                $this->deleteIconSet($branding[$iconKey] ?? []);
            }

            $branding[$key] = $path;
            if ($iconKey) {
                $branding[$iconKey] = $this->generateIconSet($file->getRealPath(), $prefix, $extension);
            }

            SettingService::set(self::BRANDING_KEY, $branding, $type);

            Cache::forget('public_homepage_v2_ecommerce');
            Cache::forget('public_homepage_v2_booking');
            Cache::forget('public_homepage_v1');
        }

        return response()->json([
            'success' => true,
            'message' => $successMessage,
            'data' => [
                'shop_logo_url' => $this->resolveLogoUrl($branding['shop_logo_path'] ?? null),
                'crm_logo_url' => $this->resolveLogoUrl($branding['crm_logo_path'] ?? null),
                'shop_favicon_url' => $this->resolveLogoUrl($branding['shop_favicon_path'] ?? null),
                'shop_favicon_icons' => $this->resolveIconUrls($branding['shop_favicon_icons'] ?? []),
                'crm_favicon_url' => $this->resolveLogoUrl($branding['crm_favicon_path'] ?? null),
                'crm_favicon_icons' => $this->resolveIconUrls($branding['crm_favicon_icons'] ?? []),
            ],
        ]);
    }

    private function defaultBranding(): array
    {
        return [
            'shop_logo_path' => null,
            'crm_logo_path' => null,
            'shop_favicon_path' => null,
            'shop_favicon_icons' => [],
            'crm_favicon_path' => null,
            'crm_favicon_icons' => [],
        ];
    }


    private function iconKeyFor(string $key): ?string
    {
        return match ($key) {
            'shop_favicon_path' => 'shop_favicon_icons',
            'crm_favicon_path' => 'crm_favicon_icons',
            default => null,
        };
    }

    private function deleteIconSet(mixed $icons): void
    {
        if (! is_array($icons)) {
            return;
        }

        foreach ($icons as $path) {
            if (is_string($path) && str_starts_with($path, 'branding/') && Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }
    }

    private function generateIconSet(?string $sourcePath, string $prefix, string $extension): array
    {
        if (! $sourcePath || ! is_file($sourcePath)) {
            return [];
        }

        $sizes = [32, 64, 180, 192, 512];
        $icons = [];

        try {
            $source = @imagecreatefromstring((string) file_get_contents($sourcePath));
            if (! $source) {
                if ($extension === 'ico') {
                    $icoPath = sprintf('branding/%s-%s.ico', $prefix, Str::random(12));
                    Storage::disk('public')->put($icoPath, (string) file_get_contents($sourcePath));
                    return ['ico' => $icoPath];
                }

                return [];
            }

            imagealphablending($source, true);
            imagesavealpha($source, true);

            foreach ($sizes as $size) {
                $pngBinary = $this->renderPngIcon($source, $size);
                if (! $pngBinary) {
                    continue;
                }

                $pngPath = sprintf('branding/%s-%d-%s.png', $prefix, $size, Str::random(12));
                Storage::disk('public')->put($pngPath, $pngBinary);
                $icons[(string) $size] = $pngPath;

                if ($size === 32) {
                    $icoPath = sprintf('branding/%s-%s.ico', $prefix, Str::random(12));
                    Storage::disk('public')->put($icoPath, $this->wrapPngAsIco($pngBinary, $size));
                    $icons['ico'] = $icoPath;
                }
            }

            imagedestroy($source);
        } catch (Throwable) {
            return [];
        }

        return $icons;
    }

    private function renderPngIcon(\GdImage $source, int $size): ?string
    {
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        if ($sourceWidth <= 0 || $sourceHeight <= 0) {
            return null;
        }

        $canvas = imagecreatetruecolor($size, $size);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefill($canvas, 0, 0, $transparent);

        $scale = min($size / $sourceWidth, $size / $sourceHeight);
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));
        $targetX = (int) floor(($size - $targetWidth) / 2);
        $targetY = (int) floor(($size - $targetHeight) / 2);

        imagecopyresampled($canvas, $source, $targetX, $targetY, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);

        ob_start();
        imagepng($canvas);
        $binary = ob_get_clean();
        imagedestroy($canvas);

        return is_string($binary) ? $binary : null;
    }

    private function wrapPngAsIco(string $pngBinary, int $size): string
    {
        $directory = pack('vvv', 0, 1, 1);
        $entry = pack('CCCCvvVV', $size >= 256 ? 0 : $size, $size >= 256 ? 0 : $size, 0, 0, 1, 32, strlen($pngBinary), 22);

        return $directory.$entry.$pngBinary;
    }

    private function resolveIconUrls(mixed $icons): array
    {
        if (! is_array($icons)) {
            return [];
        }

        $resolved = [];
        foreach ($icons as $size => $path) {
            if (is_string($path)) {
                $url = $this->resolveLogoUrl($path);
                if ($url) {
                    $resolved[(string) $size] = $url;
                }
            }
        }

        return $resolved;
    }

    private function resolveType(Request $request): string
    {
        $type = strtolower((string) $request->query('type', $request->input('type', 'ecommerce')));

        return in_array($type, ['ecommerce', 'booking'], true) ? $type : 'ecommerce';
    }

    private function resolveLogoUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        $normalizedPath = ltrim($path, '/');
        if (! $normalizedPath) {
            return null;
        }

        return Storage::disk('public')->url($normalizedPath);
    }
}
