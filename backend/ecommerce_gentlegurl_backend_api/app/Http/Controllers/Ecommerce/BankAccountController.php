<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use Illuminate\Http\Request;

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

        $payload = $validated + [
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
            'sort_order' => $validated['sort_order'] ?? 0,
        ];

        $bankAccount = BankAccount::create($payload);

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id);
        }

        return $this->respond($bankAccount, __('Bank account created.'));
    }

    public function update(Request $request, BankAccount $bankAccount)
    {
        $validated = $this->validateRequest($request, true);

        $bankAccount->fill($validated);
        $bankAccount->save();

        if ($bankAccount->is_default) {
            $this->unsetOtherDefaults($bankAccount->id);
        }

        return $this->respond($bankAccount, __('Bank account updated.'));
    }

    public function destroy(BankAccount $bankAccount)
    {
        $bankAccount->delete();

        return $this->respond(null, __('Bank account deleted.'));
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
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'qr_image_url' => ['nullable', 'string', 'max:2048'],
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
