<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Marquee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class PublicMarqueeController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = Marquee::query();

            $activeOnly = $request->boolean('active_only', true);
            $currentOnly = $request->boolean('current_only', true);

            if ($activeOnly) {
                $query->active();
            }

            if ($currentOnly) {
                $query->current();
            }

            // Check if sort_order column exists before ordering
            $marqueesTable = (new Marquee())->getTable();
            if (Schema::hasColumn($marqueesTable, 'sort_order')) {
                $query->orderBy('sort_order');
            }

            $marquees = $query
                ->orderByDesc('id')
                ->get();

            return $this->respond($marquees);
        } catch (\Exception $e) {
            Log::error('PublicMarqueeController::index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch marquees: ' . $e->getMessage(),
                'data' => null,
            ], 500);
        }
    }
}
