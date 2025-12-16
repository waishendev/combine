<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use Illuminate\Http\Request;

class PromotionController extends Controller
{
    public function index(Request $request)
    {
        $query = Promotion::query();

        if ($request->filled('is_active')) {
            $query->where('is_active', (bool) $request->boolean('is_active'));
        }

        if ($request->boolean('current_only', false)) {
            $query->current();
        }

        $promotions = $query
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate($request->get('per_page', 20));

        return $this->respond($promotions);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'button_label' => ['nullable', 'string', 'max:100'],
            'button_link' => ['nullable', 'string', 'max:255'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $promotion = Promotion::create($data);

        return $this->respond($promotion, __('Promotion created successfully.'), true, 201);
    }

    public function show(Promotion $promotion)
    {
        return $this->respond($promotion);
    }

    public function update(Request $request, Promotion $promotion)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'button_label' => ['nullable', 'string', 'max:100'],
            'button_link' => ['nullable', 'string', 'max:255'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);

        $promotion->update($data);

        return $this->respond($promotion, __('Promotion updated successfully.'));
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();

        return $this->respond(null, __('Promotion deleted successfully.'));
    }
}
