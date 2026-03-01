<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingLog;
use Illuminate\Http\Request;

class BlockController extends Controller
{
    public function index() { return $this->respond(BookingBlock::query()->latest('start_at')->paginate(50)); }

    public function store(Request $request)
    {
        $data = $request->validate([
            'scope' => ['required', 'in:STORE,STAFF'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'reason' => ['nullable', 'string'],
            'created_by_staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
        ]);
        $block = BookingBlock::create($data);

        BookingLog::create([
            'actor_type' => 'ADMIN',
            'actor_id' => optional($request->user())->id,
            'action' => 'CREATE_BLOCK',
            'meta' => ['block_id' => $block->id],
            'created_at' => now(),
        ]);

        return $this->respond($block, null, true, 201);
    }

    public function show(int $id) { return $this->respond(BookingBlock::findOrFail($id)); }
    public function update(Request $request, int $id) {
        $block = BookingBlock::findOrFail($id);
        $block->update($request->validate([
            'scope' => ['sometimes', 'in:STORE,STAFF'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date'],
            'reason' => ['nullable', 'string'],
        ]));
        return $this->respond($block);
    }
    public function destroy(int $id) { BookingBlock::findOrFail($id)->delete(); return $this->respond(null); }
}
