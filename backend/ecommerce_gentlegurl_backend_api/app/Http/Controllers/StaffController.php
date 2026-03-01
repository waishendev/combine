<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = trim((string) $request->input('search', ''));

        $staffs = Staff::query()
            ->with(['admin:id,staff_id,username,email'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
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
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'username' => ['nullable', 'string', 'max:100', 'unique:users,username'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $username = isset($validated['username']) ? trim((string) $validated['username']) : null;
        if ($username === '') {
            $username = null;
        }

        $staffRole = $this->ensureStaffRole();

        $result = DB::transaction(function () use ($validated, $username, $staffRole) {
            $staff = Staff::create([
                'code' => $validated['code'] ?? null,
                'name' => $validated['name'],
                'phone' => $validated['phone'] ?? null,
                'email' => $validated['email'],
                'commission_rate' => $validated['commission_rate'] ?? 0,
                'is_active' => $validated['is_active'] ?? true,
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'username' => $username,
                'password' => Hash::make($validated['password']),
                'is_active' => $validated['is_active'] ?? true,
                'staff_id' => $staff->id,
            ]);

            $user->roles()->sync([$staffRole->id]);

            return [
                'staff' => $staff->load('admin:id,staff_id,username,email'),
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'username' => $user->username,
                    'staff_id' => $user->staff_id,
                ],
            ];
        });

        return $this->respond($result, __('Staff and login account created successfully.'));
    }

    public function show(Staff $staff)
    {
        return $this->respond($staff->load('admin:id,staff_id,username,email'));
    }

    public function update(Request $request, Staff $staff)
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:255', Rule::unique('staffs', 'code')->ignore($staff->id)],
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($staff->admin?->id)],
            'username' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('users', 'username')->ignore($staff->admin?->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $result = DB::transaction(function () use ($staff, $validated) {
            $staff->fill($validated);
            $staff->save();

            $user = $staff->admin;
            if ($user) {
                $userPayload = [];
                if (array_key_exists('email', $validated)) {
                    $userPayload['email'] = $validated['email'];
                }
                if (array_key_exists('username', $validated)) {
                    $username = trim((string) ($validated['username'] ?? ''));
                    $userPayload['username'] = $username === '' ? null : $username;
                }
                if (! empty($validated['password'])) {
                    $userPayload['password'] = Hash::make($validated['password']);
                }
                if (array_key_exists('name', $validated)) {
                    $userPayload['name'] = $validated['name'];
                }
                if (array_key_exists('is_active', $validated)) {
                    $userPayload['is_active'] = $validated['is_active'];
                }

                if (! empty($userPayload)) {
                    $user->fill($userPayload);
                    $user->save();
                }
            }

            return $staff->load('admin:id,staff_id,username,email');
        });

        return $this->respond($result, __('Staff updated successfully.'));
    }

    public function destroy(Staff $staff)
    {
        DB::transaction(function () use ($staff) {
            $staff->is_active = false;
            $staff->save();

            $staff->admin()->update(['is_active' => false]);
        });

        return $this->respond(null, __('Staff deactivated successfully.'));
    }

    private function ensureStaffRole(): Role
    {
        $staffRole = Role::query()->whereRaw('LOWER(name) = ?', ['staff'])->first();

        if (! $staffRole) {
            $staffRole = Role::create([
                'name' => 'Staff',
                'description' => 'Staff role for POS and limited CRM access',
                'is_active' => true,
                'is_system' => true,
            ]);
        } else {
            $staffRole->fill([
                'name' => 'Staff',
                'description' => $staffRole->description ?: 'Staff role for POS and limited CRM access',
                'is_active' => true,
                'is_system' => true,
            ]);
            $staffRole->save();
        }

        $permissionSlugs = ['staff.view', 'staff.create', 'staff.update', 'staff.delete', 'pos.checkout', 'pos.orders.view'];
        $permissionIds = Permission::query()->whereIn('slug', $permissionSlugs)->pluck('id')->all();
        if (! empty($permissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($permissionIds);
        }

        return $staffRole;
    }
}
