<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class PublicPromotionController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = Promotion::query();

            $activeOnly = $request->boolean('active_only', true);
            $currentOnly = $request->boolean('current_only', true);

            if ($activeOnly) {
                $query->active();
            }

            if ($currentOnly) {
                $query->current();
            }

            // Check if sort_order column exists before ordering
            $promotionsTable = (new Promotion())->getTable();
            if (Schema::hasColumn($promotionsTable, 'sort_order')) {
                $query->orderBy('sort_order');
            }
            
            $promotions = $query
                ->orderByDesc('id')
                ->get();

            return $this->respond($promotions);
        } catch (\Exception $e) {
            Log::error('PublicPromotionController::index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch promotions: ' . $e->getMessage(),
                'data' => null,
            ], 500);
        }
    }
}
