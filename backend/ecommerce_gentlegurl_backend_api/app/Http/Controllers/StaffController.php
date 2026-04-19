<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(50, max(1, $request->integer('per_page', 15)));
        $search = trim((string) $request->input('search', ''));

        $staffs = Staff::query()
            ->with(['admin:id,staff_id,username,email'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('phone', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%")
                        ->orWhere('position', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            })
            ->when($request->has('is_active'), function ($query) use ($request) {
                $query->where('is_active', $request->boolean('is_active'));
            }, function ($query) {
                $query->where('is_active', true);
            })
            ->orderBy('name')
            ->paginate($perPage);

        return $this->respond($staffs);
    }

    public function exportCsv(Request $request)
    {
        $rows = Staff::query()
            ->with('admin:id,staff_id,username,email')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build staffs CSV export.'], 500);
        }

        $headers = [
            'id', 'code', 'name', 'phone', 'email', 'username', 'position', 'description',
            'commission_rate', 'service_commission_rate', 'is_active',
        ];
        fputcsv($stream, $headers);

        foreach ($rows as $staff) {
            fputcsv($stream, [
                $staff->id,
                $staff->code,
                $staff->name,
                $staff->phone,
                $staff->email,
                optional($staff->admin)->username,
                $staff->position,
                $staff->description,
                $staff->commission_rate,
                $staff->service_commission_rate,
                $staff->is_active ? 'true' : 'false',
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="staffs-export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to open CSV file.'], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json(['message' => 'Invalid CSV header row.'], 422);
        }

        $headers = array_map(fn ($header) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)), $headers);
        $allowedHeaders = [
            'id', 'code', 'name', 'phone', 'email', 'username', 'position', 'description',
            'commission_rate', 'service_commission_rate', 'is_active', 'password',
        ];
        $unknownHeaders = array_values(array_diff(array_filter($headers), $allowedHeaders));
        if (! empty($unknownHeaders)) {
            fclose($handle);
            return response()->json(['message' => 'Unexpected CSV headers: ' . implode(', ', $unknownHeaders)], 422);
        }

        $summary = ['totalRows' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0, 'failed' => 0, 'failedRows' => []];
        $role = $this->ensureStaffRole();
        $rowNumber = 1;

        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $raw = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $raw[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            if (count(array_filter($raw, fn ($value) => $value !== '')) === 0) {
                continue;
            }
            $summary['totalRows']++;

            $payload = [
                'id' => isset($raw['id']) && $raw['id'] !== '' ? (int) $raw['id'] : null,
                'code' => ($raw['code'] ?? '') !== '' ? $raw['code'] : null,
                'name' => $raw['name'] ?? null,
                'phone' => ($raw['phone'] ?? '') !== '' ? $raw['phone'] : null,
                'email' => $raw['email'] ?? null,
                'username' => ($raw['username'] ?? '') !== '' ? $raw['username'] : null,
                'position' => ($raw['position'] ?? '') !== '' ? $raw['position'] : null,
                'description' => ($raw['description'] ?? '') !== '' ? $raw['description'] : null,
                'commission_rate' => ($raw['commission_rate'] ?? '') !== '' ? $raw['commission_rate'] : 0,
                'service_commission_rate' => ($raw['service_commission_rate'] ?? '') !== '' ? $raw['service_commission_rate'] : 0,
                'is_active' => ($raw['is_active'] ?? '') !== '' ? filter_var($raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : true,
                'password' => ($raw['password'] ?? '') !== '' ? $raw['password'] : null,
            ];

            $staff = $payload['id'] ? Staff::query()->with('admin')->find($payload['id']) : null;
            if (! $staff && ! empty($payload['email'])) {
                $staff = Staff::query()->with('admin')->where('email', $payload['email'])->first();
            }

            $emailRule = ['required', 'email', 'max:255'];
            $codeRule = ['nullable', 'string', 'max:255'];
            $usernameRule = ['nullable', 'string', 'max:100'];
            if ($staff) {
                $codeRule[] = Rule::unique('staffs', 'code')->ignore($staff->id);
                $usernameRule[] = Rule::unique('users', 'username')->ignore(optional($staff->admin)->id);
                $emailRule[] = Rule::unique('users', 'email')->ignore(optional($staff->admin)->id);
            } else {
                $codeRule[] = 'unique:staffs,code';
                $usernameRule[] = 'unique:users,username';
                $emailRule[] = 'unique:users,email';
            }

            $validator = validator($payload, [
                'code' => $codeRule,
                'name' => ['required', 'string', 'min:2', 'max:255'],
                'phone' => ['nullable', 'string', 'max:255'],
                'email' => $emailRule,
                'username' => $usernameRule,
                'position' => ['nullable', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
                'service_commission_rate' => ['nullable', 'numeric', 'between:0,1'],
                'is_active' => ['required', 'boolean'],
                'password' => ['nullable', 'string', 'min:6'],
            ]);
            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }
            $validated = $validator->validated();

            try {
                DB::transaction(function () use ($staff, $validated, $role, &$summary) {
                    if (! $staff) {
                        $newStaff = Staff::query()->create([
                            'code' => $validated['code'] ?? null,
                            'name' => $validated['name'],
                            'phone' => $validated['phone'] ?? null,
                            'email' => $validated['email'],
                            'position' => $validated['position'] ?? null,
                            'description' => $validated['description'] ?? null,
                            'commission_rate' => $validated['commission_rate'] ?? 0,
                            'service_commission_rate' => $validated['service_commission_rate'] ?? 0,
                            'is_active' => $validated['is_active'],
                        ]);

                        $user = User::query()->create([
                            'name' => $validated['name'],
                            'email' => $validated['email'],
                            'username' => $validated['username'] ?? null,
                            'password' => Hash::make($validated['password'] ?? Str::random(12)),
                            'is_active' => $validated['is_active'],
                            'staff_id' => $newStaff->id,
                        ]);
                        $user->roles()->syncWithoutDetaching([$role->id]);
                        $summary['created']++;
                        return;
                    }

                    $admin = $staff->admin;
                    $isUnchanged =
                        (($staff->code ?? null) === ($validated['code'] ?? null)) &&
                        ($staff->name === $validated['name']) &&
                        (($staff->phone ?? null) === ($validated['phone'] ?? null)) &&
                        ($staff->email === $validated['email']) &&
                        (($staff->position ?? null) === ($validated['position'] ?? null)) &&
                        (($staff->description ?? null) === ($validated['description'] ?? null)) &&
                        ((float) $staff->commission_rate === (float) ($validated['commission_rate'] ?? 0)) &&
                        ((float) $staff->service_commission_rate === (float) ($validated['service_commission_rate'] ?? 0)) &&
                        ((bool) $staff->is_active === (bool) $validated['is_active']) &&
                        ((optional($admin)->email ?? null) === $validated['email']) &&
                        ((optional($admin)->username ?? null) === ($validated['username'] ?? null)) &&
                        ((bool) (optional($admin)->is_active ?? false) === (bool) $validated['is_active']) &&
                        empty($validated['password']);

                    if ($isUnchanged) {
                        $summary['skipped']++;
                        return;
                    }

                    $staff->update([
                        'code' => $validated['code'] ?? null,
                        'name' => $validated['name'],
                        'phone' => $validated['phone'] ?? null,
                        'email' => $validated['email'],
                        'position' => $validated['position'] ?? null,
                        'description' => $validated['description'] ?? null,
                        'commission_rate' => $validated['commission_rate'] ?? 0,
                        'service_commission_rate' => $validated['service_commission_rate'] ?? 0,
                        'is_active' => $validated['is_active'],
                    ]);

                    if ($admin) {
                        $admin->fill([
                            'name' => $validated['name'],
                            'email' => $validated['email'],
                            'username' => $validated['username'] ?? null,
                            'is_active' => $validated['is_active'],
                        ]);
                        if (! empty($validated['password'])) {
                            $admin->password = Hash::make($validated['password']);
                        }
                        $admin->save();
                        $admin->roles()->syncWithoutDetaching([$role->id]);
                    } else {
                        $user = User::query()->create([
                            'name' => $validated['name'],
                            'email' => $validated['email'],
                            'username' => $validated['username'] ?? null,
                            'password' => Hash::make($validated['password'] ?? Str::random(12)),
                            'is_active' => $validated['is_active'],
                            'staff_id' => $staff->id,
                        ]);
                        $user->roles()->syncWithoutDetaching([$role->id]);
                    }

                    $summary['updated']++;
                });
            } catch (\Throwable $throwable) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $throwable->getMessage()];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
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
            'position' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'avatar' => ['nullable', 'image', 'max:5120'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'service_commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $username = isset($validated['username']) ? trim((string) $validated['username']) : null;
        if ($username === '') {
            $username = null;
        }

        $avatarPath = $request->hasFile('avatar')
            ? $request->file('avatar')->storeAs(
                'booking/staff-avatars',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('avatar')->getClientOriginalExtension()),
                'public'
            )
            : null;

        $staffRole = $this->ensureStaffRole();

        $result = DB::transaction(function () use ($validated, $username, $staffRole, $avatarPath) {
            $staff = Staff::create([
                'code' => $validated['code'] ?? null,
                'name' => $validated['name'],
                'phone' => $validated['phone'] ?? null,
                'email' => $validated['email'],
                'position' => $validated['position'] ?? null,
                'description' => $validated['description'] ?? null,
                'avatar_path' => $avatarPath,
                'commission_rate' => $validated['commission_rate'] ?? 0,
                'service_commission_rate' => $validated['service_commission_rate'] ?? 0,
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
            'position' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'avatar' => ['nullable', 'image', 'max:5120'],
            'commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'service_commission_rate' => ['nullable', 'numeric', 'between:0,1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $newAvatarPath = $request->hasFile('avatar')
            ? $request->file('avatar')->storeAs(
                'booking/staff-avatars',
                sprintf('%s-%s.%s', now()->format('YmdHis'), Str::uuid(), $request->file('avatar')->getClientOriginalExtension()),
                'public'
            )
            : null;

        $oldAvatarPath = $staff->avatar_path;

        $result = DB::transaction(function () use ($staff, $validated, $newAvatarPath) {
            $staffPayload = collect($validated)->except(['password', 'username'])->toArray();
            if ($newAvatarPath) {
                $staffPayload['avatar_path'] = $newAvatarPath;
            }

            $staff->fill($staffPayload);
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

        if ($newAvatarPath && $oldAvatarPath && $oldAvatarPath !== $newAvatarPath && Storage::disk('public')->exists($oldAvatarPath)) {
            Storage::disk('public')->delete($oldAvatarPath);
        }

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

        $permissionSlugs = ['staff.view', 'staff.create', 'staff.update', 'staff.delete', 'pos.checkout', 'pos.orders.view', 'reports.my-pos-summary.view'];
        $permissionIds = Permission::query()->whereIn('slug', $permissionSlugs)->pluck('id')->all();
        if (! empty($permissionIds)) {
            $staffRole->permissions()->syncWithoutDetaching($permissionIds);
        }

        return $staffRole;
    }
}
