<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = trim((string) $request->input('search', ''));

        $staffs = Staff::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', $request->boolean('is_active'));
            })
            ->orderByDesc('id')
            ->paginate($perPage);

        return $this->respond($staffs);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:255', 'unique:staffs,code'],
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $staff = Staff::create([
            ...$validated,
            'commission_rate' => $validated['commission_rate'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return $this->respond($staff, __('Staff created successfully.'));
    }

    public function show(Staff $staff)
    {
        return $this->respond($staff);
    }

    public function update(Request $request, Staff $staff)
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:255', Rule::unique('staffs', 'code')->ignore($staff->id)],
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $staff->fill($validated);
        $staff->save();

        return $this->respond($staff, __('Staff updated successfully.'));
    }

    public function destroy(Staff $staff)
    {
        $staff->is_active = false;
        $staff->save();

        return $this->respond(null, __('Staff deactivated successfully.'));
    }
}
