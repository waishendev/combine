<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\CartService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
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

        try {
            Log::info('Sending email verification notification', [
                'customer_id' => $customer->id,
                'email' => $customer->email,
                'mail_driver' => config('mail.default'),
                'mailgun_domain' => config('services.mailgun.domain'),
                'mail_from' => config('mail.from'),
            ]);

            $customer->sendEmailVerificationNotification();

            Log::info('Email verification notification sent successfully', [
                'customer_id' => $customer->id,
                'email' => $customer->email,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send email verification notification', [
                'customer_id' => $customer->id,
                'email' => $customer->email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $this->respond($this->transformCustomer($customer), 'Account created. Please verify your email before logging in.');
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

        if (!$customer->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'code' => 'EMAIL_NOT_VERIFIED',
                'message' => 'Please verify your email before logging in.',
            ], 403);
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

        if (!$customer->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'code' => 'EMAIL_NOT_VERIFIED',
                'message' => 'Please verify your email before logging in.',
            ], 403);
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

    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        Log::info('Resend verification email requested', [
            'email' => $data['email'],
            'mail_driver' => config('mail.default'),
            'mailgun_domain' => config('services.mailgun.domain'),
            'mailgun_secret_set' => !empty(config('services.mailgun.secret')),
        ]);

        $customer = Customer::where('email', $data['email'])
            ->where('is_active', true)
            ->first();

        if ($customer && !$customer->hasVerifiedEmail()) {
            try {
                Log::info('Sending email verification notification (resend)', [
                    'customer_id' => $customer->id,
                    'email' => $customer->email,
                    'mail_driver' => config('mail.default'),
                    'mailgun_domain' => config('services.mailgun.domain'),
                    'mail_from' => config('mail.from'),
                ]);

                $customer->sendEmailVerificationNotification();

                Log::info('Email verification notification sent successfully (resend)', [
                    'customer_id' => $customer->id,
                    'email' => $customer->email,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send email verification notification (resend)', [
                    'customer_id' => $customer->id,
                    'email' => $customer->email,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        } else {
            Log::info('Resend verification email - customer not found or already verified', [
                'email' => $data['email'],
                'customer_found' => $customer !== null,
                'email_verified' => $customer?->hasVerifiedEmail() ?? false,
            ]);
        }

        return $this->respond(null, 'We have resend a verification link.');
    }

    public function verifyEmail(Request $request, string $id, string $hash): JsonResponse
    {
        $customer = Customer::find($id);

        if (!$customer) {
            return $this->respondError('Verification link invalid or expired.', 400);
        }

        if (!$request->hasValidSignature()) {
            return $this->respondError('Verification link invalid or expired.', 400);
        }

        if (!hash_equals($hash, sha1($customer->getEmailForVerification()))) {
            return $this->respondError('Verification link invalid or expired.', 400);
        }

        if ($customer->hasVerifiedEmail()) {
            return $this->respond(null, 'Email already verified.');
        }

        $customer->markEmailAsVerified();
        event(new Verified($customer));

        return $this->respond(null, 'Email verified successfully.');
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $customer = Customer::where('email', $data['email'])
            ->where('is_active', true)
            ->first();

        // Check if customer exists and email is verified
        if ($customer && !$customer->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'code' => 'EMAIL_NOT_VERIFIED',
                'message' => 'Please verify your email before resetting your password.',
            ], 403);
        }

        Password::broker('customers')->sendResetLink([
            'email' => $data['email'],
        ]);

        return $this->respond(null, 'If the email exists, we sent a reset link.');
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $status = Password::broker('customers')->reset(
            $data,
            function (Customer $customer, string $password) {
                $customer->forceFill([
                    'password' => $password,
                ])->setRememberToken(Str::random(60));

                $customer->save();

                event(new PasswordReset($customer));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->respondError(__($status), 422);
        }

        return $this->respond(null, 'Password reset successfully.');
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
