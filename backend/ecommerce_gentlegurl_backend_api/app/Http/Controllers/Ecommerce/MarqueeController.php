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
        $type = $this->resolveType($request);
        $query = Marquee::query()->ofType($type);

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
            'type' => ['nullable', 'string', 'in:ecommerce,booking'],
            'text' => ['required', 'string'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
        ]);

        $type = $data['type'] ?? $this->resolveType($request);
        $data['type'] = $type;
        $data['sort_order'] = (Marquee::query()->ofType($type)->max('sort_order') ?? 0) + 1;

        $marquee = Marquee::create($data);

        return $this->respond($marquee, __('Marquee created successfully.'), true, 201);
    }

    public function show(Request $request, Marquee $marquee)
    {
        $this->assertTypeMatch($request, $marquee);

        return $this->respond($marquee);
    }

    public function update(Request $request, Marquee $marquee)
    {
        $this->assertTypeMatch($request, $marquee);

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

    public function destroy(Request $request, Marquee $marquee)
    {
        $this->assertTypeMatch($request, $marquee);

        $marquee->delete();

        return $this->respond(null, __('Marquee deleted successfully.'));
    }

    public function moveUp(Request $request, Marquee $marquee)
    {
        $this->assertTypeMatch($request, $marquee);

        return DB::transaction(function () use ($marquee) {
            $oldPosition = $marquee->sort_order;

            $previousMarquee = Marquee::query()
                ->ofType($marquee->type)
                ->where('sort_order', '<', $marquee->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousMarquee) {
                return $this->respond(null, __('Marquee is already at the top.'), false, 400);
            }

            $newPosition = $previousMarquee->sort_order;

            $marquee->sort_order = $newPosition;
            $marquee->save();

            $previousMarquee->sort_order = $oldPosition;
            $previousMarquee->save();

            return $this->respond([
                'id' => $marquee->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Marquee moved up successfully.'));
        });
    }

    public function moveDown(Request $request, Marquee $marquee)
    {
        $this->assertTypeMatch($request, $marquee);

        return DB::transaction(function () use ($marquee) {
            $oldPosition = $marquee->sort_order;

            $nextMarquee = Marquee::query()
                ->ofType($marquee->type)
                ->where('sort_order', '>', $marquee->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextMarquee) {
                return $this->respond(null, __('Marquee is already at the bottom.'), false, 400);
            }

            $newPosition = $nextMarquee->sort_order;

            $marquee->sort_order = $newPosition;
            $marquee->save();

            $nextMarquee->sort_order = $oldPosition;
            $nextMarquee->save();

            return $this->respond([
                'id' => $marquee->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Marquee moved down successfully.'));
        });
    }

    private function resolveType(Request $request): string
    {
        $type = $request->get('type');

        return in_array($type, [Marquee::TYPE_ECOMMERCE, Marquee::TYPE_BOOKING], true)
            ? $type
            : Marquee::TYPE_ECOMMERCE;
    }

    private function assertTypeMatch(Request $request, Marquee $marquee): void
    {
        if ($marquee->type !== $this->resolveType($request)) {
            abort(404);
        }
    }
}
