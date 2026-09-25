<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingQuestionPreset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QuestionPresetController extends Controller
{
    public function index(Request $request)
    {
        $query = BookingQuestionPreset::query()->withCount('options')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%' . trim((string) $request->input('search')) . '%';
                $query->where(fn ($q) => $q->where('name', 'ilike', $term)->orWhere('title', 'ilike', $term)->orWhere('cn_title', 'ilike', $term));
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $active = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($active !== null) $query->where('is_active', $active);
            })
            ->orderBy('name')->orderBy('id');

        if ($request->boolean('all')) {
            return $this->respond($query->limit(min(500, max(1, $request->integer('limit', 200))))->get());
        }

        return $this->respond($query->paginate(min(100, max(1, $request->integer('per_page', 20)))));
    }

    public function show(BookingQuestionPreset $questionPreset)
    {
        return $this->respond($questionPreset->load('options'));
    }

    public function store(Request $request)
    {
        $preset = DB::transaction(fn () => $this->persist(new BookingQuestionPreset(), $this->validated($request)));
        return $this->respond($preset, 'Question preset created.', true, 201);
    }

    public function update(Request $request, BookingQuestionPreset $questionPreset)
    {
        $preset = DB::transaction(fn () => $this->persist($questionPreset, $this->validated($request)));
        return $this->respond($preset, 'Question preset updated.');
    }

    public function destroy(BookingQuestionPreset $questionPreset)
    {
        $questionPreset->delete();
        return $this->respond(null, 'Question preset deleted.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'cn_title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cn_description' => ['nullable', 'string'],
            'question_type' => ['required', Rule::in(['single_choice', 'multi_choice'])],
            'is_required' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'options' => ['required', 'array', 'min:1'],
            'options.*.label' => ['required', 'string', 'max:255'],
            'options.*.cn_label' => ['nullable', 'string', 'max:255'],
            'options.*.is_active' => ['nullable', 'boolean'],
            'options.*.allow_quantity' => ['nullable', 'boolean'],
        ]);
    }

    private function persist(BookingQuestionPreset $preset, array $data): BookingQuestionPreset
    {
        $options = $data['options']; unset($data['options']);
        $preset->fill($data)->save();
        $preset->options()->delete();
        foreach ($options as $index => $option) {
            $preset->options()->create([
                'label' => trim((string) $option['label']),
                'cn_label' => trim((string) ($option['cn_label'] ?? '')) ?: null,
                'sort_order' => $index,
                'is_active' => (bool) ($option['is_active'] ?? true),
                'allow_quantity' => (bool) ($option['allow_quantity'] ?? true),
            ]);
        }
        return $preset->load('options')->loadCount('options');
    }
}
