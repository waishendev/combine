<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\BranchCapacityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchLimitSettingController extends Controller
{
    public function show(Request $request, BranchCapacityService $capacity): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return $this->respondError(__('Only the Platform Super Admin can manage the branch limit.'), 403);
        }

        return $this->respond($capacity->usage());
    }

    public function update(Request $request, BranchCapacityService $capacity): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return $this->respondError(__('Only the Platform Super Admin can manage the branch limit.'), 403);
        }

        $validated = $request->validate([
            'limit' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);

        Setting::updateOrCreate(
            ['type' => 'ecommerce', 'key' => BranchCapacityService::SETTING_KEY],
            ['value' => $validated['limit']]
        );

        return $this->respond($capacity->usage(), __('Branch limit updated successfully.'));
    }
}
