<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Marquee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MarqueeController extends Controller
{
    public function index(Request $request)
    {
        $query = Marquee::query();

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->boolean('current_only', false)) {
            $query->current();
        }

        $marquees = $query
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate($request->get('per_page', 20));

        return $this->respond($marquees);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'text' => ['required', 'string'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
        ]);

        // Automatically set sort_order to the next available value
        $sortOrder = (Marquee::max('sort_order') ?? 0) + 1;
        $data['sort_order'] = $sortOrder;

        $marquee = Marquee::create($data);

        return $this->respond($marquee, __('Marquee created successfully.'), true, 201);
    }

    public function show(Marquee $marquee)
    {
        return $this->respond($marquee);
    }

    public function update(Request $request, Marquee $marquee)
    {
        $data = $request->validate([
            'text' => ['sometimes', 'required', 'string'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $marquee->update($data);

        return $this->respond($marquee, __('Marquee updated successfully.'));
    }

    public function destroy(Marquee $marquee)
    {
        $marquee->delete();

        return $this->respond(null, __('Marquee deleted successfully.'));
    }

    public function moveUp(Marquee $marquee)
    {
        return DB::transaction(function () use ($marquee) {
            $oldPosition = $marquee->sort_order;

            // Find the previous marquee (lower sort_order)
            $previousMarquee = Marquee::where('sort_order', '<', $marquee->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousMarquee) {
                // Already at the top
                return $this->respond(null, __('Marquee is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousMarquee->sort_order;

            $marquee->sort_order = $newPosition;
            $marquee->save();

            $previousMarquee->sort_order = $oldPosition;
            $previousMarquee->save();

            // Return metadata only
            return $this->respond([
                'id' => $marquee->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Marquee moved up successfully.'));
        });
    }

    public function moveDown(Marquee $marquee)
    {
        return DB::transaction(function () use ($marquee) {
            $oldPosition = $marquee->sort_order;

            // Find the next marquee (higher sort_order)
            $nextMarquee = Marquee::where('sort_order', '>', $marquee->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextMarquee) {
                // Already at the bottom
                return $this->respond(null, __('Marquee is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextMarquee->sort_order;

            $marquee->sort_order = $newPosition;
            $marquee->save();

            $nextMarquee->sort_order = $oldPosition;
            $nextMarquee->save();

            // Return metadata only
            return $this->respond([
                'id' => $marquee->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Marquee moved down successfully.'));
        });
    }
}
