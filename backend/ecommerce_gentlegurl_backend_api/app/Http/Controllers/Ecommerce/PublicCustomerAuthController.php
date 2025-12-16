<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\CartService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class PublicCustomerAuthController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(protected CartService $cartService)
    {
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $customer = Customer::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
            'is_active' => true,
        ]);

        auth('customer')->login($customer);
        $request->session()->regenerate();

        return $this->respond($this->transformCustomer($customer));
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        /** @var Customer|null $customer */
        $customer = Customer::where('email', $credentials['email'])
            ->where('is_active', true)
            ->first();

        if (!$customer || !Hash::check($credentials['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        auth('customer')->login($customer);
        $request->session()->regenerate();

        $customer->forceFill([
            'last_login_at' => Date::now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if (!empty($credentials['session_token'])) {
            $this->cartService->mergeGuestCartIntoCustomer($credentials['session_token'], $customer);
        }

        return $this->respond($this->transformCustomer($customer->fresh()));
    }

    public function loginWithToken(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        /** @var Customer|null $customer */
        $customer = Customer::where('email', $credentials['email'])
            ->where('is_active', true)
            ->first();

        if (!$customer || !Hash::check($credentials['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        auth('customer')->login($customer);
        $request->session()->regenerate();

        $customer->forceFill([
            'last_login_at' => Date::now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        if (!empty($credentials['session_token'])) {
            $this->cartService->mergeGuestCartIntoCustomer($credentials['session_token'], $customer);
        }

        $token = $customer->createToken('shop')->plainTextToken;

        return $this->respond($this->transformCustomer($customer->fresh(), $token));
    }

    public function logout(Request $request)
    {
        auth('customer')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->respond(null, __('Logged out successfully.'));
    }

    public function profile(Request $request): JsonResponse
    {
        /** @var Customer|null $customer */
        $customer = $request->user('customer') ?? $request->user();

        if (!$customer) {
            return response()->json([
                'data' => null,
                'message' => 'Unauthenticated',
                'success' => false,
            ], 401);
        }

        $customer->load(['addresses' => function ($query) {
            $query->orderByDesc('is_default')
                ->orderBy('id');
        }]);

        return $this->respond($this->transformCustomer($customer));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user('customer') ?? $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30', 'unique:customers,phone,' . $customer->id],
            'gender' => ['sometimes', 'nullable', 'in:male,female,other'],
            'date_of_birth' => ['sometimes', 'nullable', 'date'],
            'avatar' => ['sometimes', 'nullable', 'string', 'max:255'],
            'photo' => ['sometimes', 'nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
        ]);

        DB::transaction(function () use (&$customer, $data, $request) {
            $customer->fill(collect($data)->only(['name', 'phone', 'gender', 'date_of_birth', 'avatar'])->toArray());

            if ($request->hasFile('photo')) {
                if ($customer->avatar && str_starts_with($customer->avatar, 'avatars/') && Storage::disk('public')->exists($customer->avatar)) {
                    Storage::disk('public')->delete($customer->avatar);
                }

                $file = $request->file('photo');
                $filename = 'avatars/' . uniqid() . '.' . $file->getClientOriginalExtension();
                $customer->avatar = $file->storeAs('', $filename, 'public');
            }

            $customer->save();
        });

        $customer->load(['addresses' => function ($query) {
            $query->orderByDesc('is_default')
                ->orderBy('id');
        }]);

        return $this->respond($this->transformCustomer($customer), 'Profile updated successfully.');
    }

    public function changePassword(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user('customer') ?? $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        if (!Hash::check($data['current_password'], $customer->password)) {
            throw ValidationException::withMessages([
                'current_password' => __('The current password is incorrect.'),
            ]);
        }

        $customer->password = $data['password'];
        $customer->save();

        return $this->respond($this->transformCustomer($customer), 'Password updated successfully.');
    }

    private function transformCustomer(Customer $customer, ?string $token = null): array
    {
        $data = [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'avatar' => $customer->avatar,
            'gender' => $customer->gender,
            'date_of_birth' => optional($customer->date_of_birth)->toDateString(),
            'tier' => $customer->tier,
        ];

        if ($token) {
            $data['token'] = $token;
        }

        if ($customer->relationLoaded('addresses')) {
            $data['addresses'] = $customer->addresses;
        }

        return $data;
    }
}
