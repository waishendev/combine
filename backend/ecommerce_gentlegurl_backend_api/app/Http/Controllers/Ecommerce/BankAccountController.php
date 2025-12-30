<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BankAccountController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $bankAccounts = BankAccount::query()
            ->when($request->filled('is_active'), fn($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate($perPage);

        return $this->respond($bankAccounts);
    }

    public function show(BankAccount $bankAccount)
    {
        return $this->respond($bankAccount);
    }

    public function store(Request $request)
    {
        $validated = $this->validateRequest($request);

        // Auto-set sort_order: get max + 1 (place at bottom)
        $sortOrder = (BankAccount::max('sort_order') ?? 0) + 1;

        $payload = $validated + [
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
            'sort_order' => $sortOrder,
        ];

        // Handle logo file upload
        if ($request->hasFile('logo_file')) {
            $file = $request->file('logo_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $payload['logo_path'] = $file->storeAs('', $filename, 'public');
        }

        // Handle QR image file upload
        if ($request->hasFile('qr_image_file')) {
            $file = $request->file('qr_image_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $payload['qr_image_path'] = $file->storeAs('', $filename, 'public');
        }

        // Remove file fields from payload as they're not database fields
        unset($payload['logo_file'], $payload['qr_image_file']);

        $bankAccount = BankAccount::create($payload);

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id);
        }

        return $this->respond($bankAccount, __('Bank account created.'));
    }

    public function update(Request $request, BankAccount $bankAccount)
    {
        $validated = $this->validateRequest($request, true);

        // Handle logo file upload
        if ($request->hasFile('logo_file')) {
            // Delete old logo if it was stored locally
            if ($bankAccount->logo_path && str_starts_with($bankAccount->logo_path, 'bank-accounts/') && Storage::disk('public')->exists($bankAccount->logo_path)) {
                Storage::disk('public')->delete($bankAccount->logo_path);
            }

            $file = $request->file('logo_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $validated['logo_path'] = $file->storeAs('', $filename, 'public');
        }

        // Handle QR image file upload
        if ($request->hasFile('qr_image_file')) {
            // Delete old QR image if it was stored locally
            if ($bankAccount->qr_image_path && str_starts_with($bankAccount->qr_image_path, 'bank-accounts/') && Storage::disk('public')->exists($bankAccount->qr_image_path)) {
                Storage::disk('public')->delete($bankAccount->qr_image_path);
            }

            $file = $request->file('qr_image_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $validated['qr_image_path'] = $file->storeAs('', $filename, 'public');
        }

        // Remove file fields from validated data as they're not database fields
        unset($validated['logo_file'], $validated['qr_image_file']);

        $bankAccount->fill($validated);
        $bankAccount->save();

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id);
        }

        return $this->respond($bankAccount, __('Bank account updated.'));
    }

    public function destroy(BankAccount $bankAccount)
    {
        // Delete logo file if it was stored locally
        if ($bankAccount->logo_path && str_starts_with($bankAccount->logo_path, 'bank-accounts/')) {
            if (Storage::disk('public')->exists($bankAccount->logo_path)) {
                Storage::disk('public')->delete($bankAccount->logo_path);
            }
        }

        // Delete QR image file if it was stored locally
        if ($bankAccount->qr_image_path && str_starts_with($bankAccount->qr_image_path, 'bank-accounts/')) {
            if (Storage::disk('public')->exists($bankAccount->qr_image_path)) {
                Storage::disk('public')->delete($bankAccount->qr_image_path);
            }
        }

        $bankAccount->delete();

        return $this->respond(null, __('Bank account deleted.'));
    }

    public function moveUp(BankAccount $bankAccount)
    {
        return DB::transaction(function () use ($bankAccount) {
            $oldPosition = $bankAccount->sort_order;

            // Find the previous item (lower sort_order)
            $previousItem = BankAccount::where('sort_order', '<', $bankAccount->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousItem) {
                // Already at the top
                return $this->respond(null, __('Bank account is already at the top.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $previousItem->sort_order;

            $bankAccount->sort_order = $newPosition;
            $bankAccount->save();

            $previousItem->sort_order = $oldPosition;
            $previousItem->save();

            // Return metadata only
            return $this->respond([
                'id' => $bankAccount->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Bank account moved up successfully.'));
        });
    }

    public function moveDown(BankAccount $bankAccount)
    {
        return DB::transaction(function () use ($bankAccount) {
            $oldPosition = $bankAccount->sort_order;

            // Find the next item (higher sort_order)
            $nextItem = BankAccount::where('sort_order', '>', $bankAccount->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextItem) {
                // Already at the bottom
                return $this->respond(null, __('Bank account is already at the bottom.'), false, 400);
            }

            // Swap sort_order values
            $newPosition = $nextItem->sort_order;

            $bankAccount->sort_order = $newPosition;
            $bankAccount->save();

            $nextItem->sort_order = $oldPosition;
            $nextItem->save();

            // Return metadata only
            return $this->respond([
                'id' => $bankAccount->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Bank account moved down successfully.'));
        });
    }

    protected function validateRequest(Request $request, bool $isUpdate = false): array
    {
        $rules = [
            'label' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'bank_name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'account_name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'account_number' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'swift_code' => ['nullable', 'string', 'max:255'],
            'logo_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'qr_image_file' => ['nullable', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'instructions' => ['nullable', 'string'],
        ];

        return $request->validate($rules);
    }

    protected function unsetOtherDefaults(int $bankAccountId): void
    {
        BankAccount::where('id', '!=', $bankAccountId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
