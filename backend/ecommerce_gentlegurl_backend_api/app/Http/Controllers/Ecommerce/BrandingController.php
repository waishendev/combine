<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BrandingController extends Controller
{
    private const BRANDING_KEY = 'branding';

    public function show(): JsonResponse
    {
        $branding = SettingService::get(self::BRANDING_KEY, $this->defaultBranding());

        return response()->json([
            'success' => true,
            'data' => [
                'shop_logo_url' => $this->resolveLogoUrl($branding['shop_logo_path'] ?? null),
                'crm_logo_url' => $this->resolveLogoUrl($branding['crm_logo_path'] ?? null),
            ],
            'message' => null,
        ]);
    }

    public function uploadShopLogo(Request $request): JsonResponse
    {
        return $this->uploadLogo($request, 'shop_logo_path', 'shop-logo');
    }

    public function uploadCrmLogo(Request $request): JsonResponse
    {
        return $this->uploadLogo($request, 'crm_logo_path', 'crm-logo');
    }

    private function uploadLogo(Request $request, string $key, string $prefix): JsonResponse
    {
        $validated = $request->validate([
            'logo_file' => ['required', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        $branding = SettingService::get(self::BRANDING_KEY, $this->defaultBranding());
        $existingPath = $branding[$key] ?? null;

        if ($request->hasFile('logo_file')) {
            $file = $request->file('logo_file');
            $extension = $file->getClientOriginalExtension();
            $filename = sprintf('%s-%s.%s', $prefix, Str::random(12), $extension);
            $path = $file->storeAs('branding', $filename, 'public');

            if ($existingPath && str_starts_with($existingPath, 'branding/')) {
                if (Storage::disk('public')->exists($existingPath)) {
                    Storage::disk('public')->delete($existingPath);
                }
            }

            $branding[$key] = $path;
            SettingService::set(self::BRANDING_KEY, $branding);

            Cache::forget('public_homepage_v2');
            Cache::forget('public_homepage_v1');
        }

        return response()->json([
            'success' => true,
            'message' => 'Logo updated successfully.',
            'data' => [
                'shop_logo_url' => $this->resolveLogoUrl($branding['shop_logo_path'] ?? null),
                'crm_logo_url' => $this->resolveLogoUrl($branding['crm_logo_path'] ?? null),
            ],
        ]);
    }

    private function defaultBranding(): array
    {
        return [
            'shop_logo_path' => null,
            'crm_logo_path' => null,
        ];
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
