<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\HomeSlider;
use Illuminate\Support\Facades\Log;

class PublicHomeSliderController extends Controller
{
    public function index()
    {
        try {
            $now = now();

            $sliders = HomeSlider::query()
                ->where('is_active', true)
                ->where(function ($q) use ($now) {
                    $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
                })
                ->where(function ($q) use ($now) {
                    $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
                })
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get([
                    'id',
                    'title',
                    'subtitle',
                    'image_path',
                    'mobile_image_path',
                    'button_label',
                    'button_link',
                ]);

            return $this->respond($sliders);
        } catch (\Exception $e) {
            Log::error('PublicHomeSliderController::index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch home sliders: ' . $e->getMessage(),
                'data' => null,
            ], 500);
        }
    }
}
