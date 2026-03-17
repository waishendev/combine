<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BankAccountController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $type = WorkspaceType::fromRequest($request);

        $bankAccounts = BankAccount::query()
            ->where('type', $type)
            ->when($request->filled('is_active'), fn($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->paginate($perPage);

        return $this->respond($bankAccounts);
    }

    public function show(Request $request, BankAccount $bankAccount)
    {
        $this->ensureTypeMatch($request, $bankAccount);

        return $this->respond($bankAccount);
    }

    public function store(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $validated = $this->validateRequest($request);

        $sortOrder = (BankAccount::where('type', $type)->max('sort_order') ?? 0) + 1;

        $payload = $validated + [
            'type' => $type,
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
            'sort_order' => $sortOrder,
        ];

        if ($request->hasFile('logo_file')) {
            $file = $request->file('logo_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $payload['logo_path'] = $file->storeAs('', $filename, 'public');
        }

        if ($request->hasFile('qr_image_file')) {
            $file = $request->file('qr_image_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $payload['qr_image_path'] = $file->storeAs('', $filename, 'public');
        }

        unset($payload['logo_file'], $payload['qr_image_file']);

        $bankAccount = BankAccount::create($payload);

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id, $type);
        }

        return $this->respond($bankAccount, __('Bank account created.'));
    }

    public function update(Request $request, BankAccount $bankAccount)
    {
        $type = $this->ensureTypeMatch($request, $bankAccount);
        $validated = $this->validateRequest($request, true);

        if ($request->hasFile('logo_file')) {
            if ($bankAccount->logo_path && str_starts_with($bankAccount->logo_path, 'bank-accounts/') && Storage::disk('public')->exists($bankAccount->logo_path)) {
                Storage::disk('public')->delete($bankAccount->logo_path);
            }

            $file = $request->file('logo_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $validated['logo_path'] = $file->storeAs('', $filename, 'public');
        }

        if ($request->hasFile('qr_image_file')) {
            if ($bankAccount->qr_image_path && str_starts_with($bankAccount->qr_image_path, 'bank-accounts/') && Storage::disk('public')->exists($bankAccount->qr_image_path)) {
                Storage::disk('public')->delete($bankAccount->qr_image_path);
            }

            $file = $request->file('qr_image_file');
            $filename = 'bank-accounts/' . uniqid() . '.' . $file->getClientOriginalExtension();
            $validated['qr_image_path'] = $file->storeAs('', $filename, 'public');
        }

        unset($validated['logo_file'], $validated['qr_image_file'], $validated['type']);

        $bankAccount->fill($validated);
        $bankAccount->save();

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id, $type);
        }

        return $this->respond($bankAccount, __('Bank account updated.'));
    }

    public function destroy(Request $request, BankAccount $bankAccount)
    {
        $this->ensureTypeMatch($request, $bankAccount);

        if ($bankAccount->logo_path && str_starts_with($bankAccount->logo_path, 'bank-accounts/')) {
            if (Storage::disk('public')->exists($bankAccount->logo_path)) {
                Storage::disk('public')->delete($bankAccount->logo_path);
            }
        }

        if ($bankAccount->qr_image_path && str_starts_with($bankAccount->qr_image_path, 'bank-accounts/')) {
            if (Storage::disk('public')->exists($bankAccount->qr_image_path)) {
                Storage::disk('public')->delete($bankAccount->qr_image_path);
            }
        }

        $bankAccount->delete();

        return $this->respond(null, __('Bank account deleted.'));
    }

    public function moveUp(Request $request, BankAccount $bankAccount)
    {
        $type = $this->ensureTypeMatch($request, $bankAccount);

        return DB::transaction(function () use ($bankAccount, $type) {
            $oldPosition = $bankAccount->sort_order;

            $previousItem = BankAccount::where('type', $type)
                ->where('sort_order', '<', $bankAccount->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousItem) {
                return $this->respond(null, __('Bank account is already at the top.'), false, 400);
            }

            $newPosition = $previousItem->sort_order;

            $bankAccount->sort_order = $newPosition;
            $bankAccount->save();

            $previousItem->sort_order = $oldPosition;
            $previousItem->save();

            return $this->respond([
                'id' => $bankAccount->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Bank account moved up successfully.'));
        });
    }

    public function moveDown(Request $request, BankAccount $bankAccount)
    {
        $type = $this->ensureTypeMatch($request, $bankAccount);

        return DB::transaction(function () use ($bankAccount, $type) {
            $oldPosition = $bankAccount->sort_order;

            $nextItem = BankAccount::where('type', $type)
                ->where('sort_order', '>', $bankAccount->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextItem) {
                return $this->respond(null, __('Bank account is already at the bottom.'), false, 400);
            }

            $newPosition = $nextItem->sort_order;

            $bankAccount->sort_order = $newPosition;
            $bankAccount->save();

            $nextItem->sort_order = $oldPosition;
            $nextItem->save();

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

    protected function unsetOtherDefaults(int $bankAccountId, string $type): void
    {
        BankAccount::where('type', $type)
            ->where('id', '!=', $bankAccountId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    protected function ensureTypeMatch(Request $request, BankAccount $bankAccount): string
    {
        $type = WorkspaceType::fromRequest($request, $bankAccount->type ?: WorkspaceType::ECOMMERCE);

        abort_unless($bankAccount->type === $type, 404);

        return $type;
    }
}
