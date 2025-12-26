<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = Auth::user();

        if (! $user->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return $this->respond(null, __('This account is inactive.'), false, 403);
        }

        if (! $this->hasNonSystemRole($user)) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return $this->respond(null, __('This account does not have access.'), false, 403);
        }

        $user->forceFill([
            'last_login_at' => Date::now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        return $this->respond($this->transformUser($user->fresh(['roles.permissions'])));
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->respond(null, __('Logged out successfully.'));
    }


    
    public function me(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        return $this->respond([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'roles' => $this->getNonSystemRoles($user)->pluck('name')->values()->toArray(),
            'permissions' => $user->getNonSystemPermissions()->toArray(),
        ]);
    }


    public function profile(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        return $this->respond($this->transformUser($user));
    }

    public function loginWithToken(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        /** @var User|null $user */
        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['error' => __('This account is inactive.')], 403);
        }

        if (! $this->hasNonSystemRole($user)) {
            return response()->json(['error' => __('This account does not have access.')], 403);
        }

        Auth::login($user);

        $user->forceFill([
            'last_login_at' => Date::now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $token = $user->createToken('admin-api')->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'username' => $user->username,
                ],
            ],
        ]);
    }

    private function transformUser(User $user): array
    {
        $permissions = $user->getNonSystemPermissions();
        $roles = $this->getNonSystemRoles($user);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'is_active' => $user->is_active,
            'roles' => $roles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
            ])->values(),
            'permissions' => $permissions,
        ];
    }

    private function hasNonSystemRole(User $user): bool
    {
        return $user->roles()->where('is_system', false)->exists();
    }

    private function getNonSystemRoles(User $user)
    {
        return $user->roles()->where('is_system', false)->get();
    }
}
