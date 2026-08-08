<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingLog;
use Illuminate\Http\Request;
use App\Services\Booking\BookingBranchScheduleService;
use App\Services\StoreLocationAccessService;

class BlockController extends Controller
{
    public function __construct(private readonly BookingBranchScheduleService $branchSchedules, private readonly StoreLocationAccessService $storeAccess) {}

    public function index(Request $request)
    {
        $accessibleIds = $this->storeAccess->accessibleStoreLocations($request->user(), false)->pluck('id');
        $query = BookingBlock::query()->with(['staff:id,name','storeLocation:id,name,code'])
            ->where(fn ($scope) => $scope->whereIn('store_location_id', $accessibleIds)
                ->when($this->storeAccess->hasPlatformBypass($request->user()), fn ($legacy) => $legacy->orWhereNull('store_location_id')));
        if ($request->filled('branch_store_location_id')) {
            $branch = $this->branchSchedules->authorizeOperationalBranch($request->user(), $request->integer('branch_store_location_id'));
            $query->where('store_location_id', $branch->id);
        }

        if ($request->filled('scope')) {
            $query->where('scope', $request->string('scope'));
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->staff_id);
        }

        if ($request->filled('from')) {
            $query->where('start_at', '>=', $request->string('from'));
        }

        if ($request->filled('to')) {
            $query->where('end_at', '<=', $request->string('to'));
        }

        return $this->respond($query->latest('start_at')->paginate(50));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'scope' => ['required', 'in:STORE,STAFF'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'store_location_id' => ['required', 'integer', 'exists:store_locations,id'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'reason' => ['nullable', 'string'],
            'created_by_staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
        ]);
        $this->branchSchedules->authorizeOperationalBranch($request->user(), (int) $data['store_location_id']);
        if (($data['scope'] ?? '') === 'STAFF') {
            if (empty($data['staff_id'])) abort(422, 'Staff is required for a Staff block.');
            $this->branchSchedules->assertStaffAssigned((int) $data['staff_id'], (int) $data['store_location_id']);
        } else {
            $data['staff_id'] = null;
        }
        $block = BookingBlock::create($data);

        BookingLog::create([
            'actor_type' => 'ADMIN',
            'actor_id' => optional($request->user())->id,
            'action' => 'CREATE_BLOCK',
            'meta' => ['block_id' => $block->id],
            'created_at' => now(),
        ]);

        return $this->respond($block->load(['staff:id,name','storeLocation:id,name,code']), null, true, 201);
    }

    public function show(Request $request, int $id)
    {
        $block = BookingBlock::with(['staff:id,name','storeLocation:id,name,code'])->findOrFail($id);
        $this->authorizeRecord($request, $block);
        return $this->respond($block);
    }

    public function update(Request $request, int $id)
    {
        $block = BookingBlock::findOrFail($id);
        $this->authorizeRecord($request, $block);
        $data = $request->validate([
            'scope' => ['sometimes', 'in:STORE,STAFF'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'store_location_id' => ['sometimes', 'integer', 'exists:store_locations,id'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date', 'after:start_at'],
            'reason' => ['nullable', 'string'],
        ]);
        $branchId = (int) ($data['store_location_id'] ?? $block->store_location_id);
        $this->branchSchedules->authorizeOperationalBranch($request->user(), $branchId);
        $scope = (string) ($data['scope'] ?? $block->scope);
        $staffId = $data['staff_id'] ?? $block->staff_id;
        if ($scope === 'STAFF') {
            if (! $staffId) abort(422, 'Staff is required for a Staff block.');
            $this->branchSchedules->assertStaffAssigned((int) $staffId, $branchId);
        } else $data['staff_id'] = null;
        $block->update($data);

        return $this->respond($block->load(['staff:id,name','storeLocation:id,name,code']));
    }

    public function destroy(Request $request, int $id)
    {
        $block=BookingBlock::findOrFail($id); $this->authorizeRecord($request,$block); $block->delete();

        return $this->respond(null);
    }

    private function authorizeRecord(Request $request, BookingBlock $block): void
    {
        if ($block->store_location_id !== null) $this->branchSchedules->authorizeOperationalBranch($request->user(), (int) $block->store_location_id);
        elseif (! $this->storeAccess->hasPlatformBypass($request->user())) abort(403, 'Legacy unattributed blocks require platform reconciliation access.');
    }
}
