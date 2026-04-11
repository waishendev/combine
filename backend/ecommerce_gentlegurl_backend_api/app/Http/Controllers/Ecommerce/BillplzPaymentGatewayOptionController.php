<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BillplzPaymentGatewayOption;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BillplzPaymentGatewayOptionController extends Controller
{
    public function publicIndex(Request $request)
    {
        $validated = $request->validate([
            'type' => ['nullable', 'string', Rule::in([WorkspaceType::ECOMMERCE, WorkspaceType::BOOKING])],
            'gateway_group' => ['required', 'string', Rule::in(['online_banking', 'credit_card'])],
        ]);

        $type = $validated['type'] ?? WorkspaceType::fromRequest($request, WorkspaceType::ECOMMERCE);
        $gatewayGroup = (string) $validated['gateway_group'];

        $options = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $gatewayGroup)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'code', 'logo_url', 'is_default', 'sort_order']);

        $data = $options->map(fn (BillplzPaymentGatewayOption $o) => [
            'id' => $o->id,
            'name' => $o->name,
            'code' => $o->code,
            'logo_url' => $this->absolutePublicUrl($o->getAttributes()['logo_url'] ?? null),
            'is_default' => $o->is_default,
            'sort_order' => $o->sort_order,
        ]);

        return $this->respond($data);
    }

    public function index(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $perPage = $request->integer('per_page', 15);

        $options = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->when($request->filled('gateway_group'), fn ($q) => $q->where('gateway_group', $request->string('gateway_group')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('gateway_group')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage);

        $options->getCollection()->transform(fn (BillplzPaymentGatewayOption $o) => $this->transformOptionForApi($o));

        return $this->respond($options);
    }

    public function show(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $this->ensureTypeMatch($request, $paymentGatewayOption);

        return $this->respond($this->transformOptionForApi($paymentGatewayOption));
    }

    public function store(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $validated = $this->validatePayload($request, null, $type);

        $payload = Arr::except($validated, ['logo']);
        $payload['type'] = $type;
        $payload['is_active'] = $validated['is_active'] ?? true;
        $payload['is_default'] = $validated['is_default'] ?? false;

        $maxSortOrder = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $payload['gateway_group'])
            ->max('sort_order') ?? 0;
        $payload['sort_order'] = $validated['sort_order'] ?? ($maxSortOrder + 1);

        if ($request->hasFile('logo')) {
            $payload['logo_url'] = $this->storeUploadedLogo($request->file('logo'), (string) $payload['code']);
        } elseif (empty($payload['logo_url'] ?? null)) {
            $payload['logo_url'] = $this->defaultLogoPathForCode((string) $payload['code']);
        }

        $option = BillplzPaymentGatewayOption::create($payload);

        if ($option->is_default) {
            $this->unsetOtherDefaults($option->id, $type, $option->gateway_group);
        }

        return $this->respond($this->transformOptionForApi($option->fresh()), __('Billplz payment option created.'));
    }

    public function update(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $type = $this->ensureTypeMatch($request, $paymentGatewayOption);
        $validated = $this->validatePayload($request, $paymentGatewayOption, $type);

        $fill = Arr::except($validated, ['logo']);
        $paymentGatewayOption->fill($fill);

        if ($request->hasFile('logo')) {
            $paymentGatewayOption->logo_url = $this->storeUploadedLogo($request->file('logo'), $paymentGatewayOption->code);
        }

        $paymentGatewayOption->save();

        if ($paymentGatewayOption->is_default) {
            $this->unsetOtherDefaults($paymentGatewayOption->id, $type, $paymentGatewayOption->gateway_group);
        }

        return $this->respond($this->transformOptionForApi($paymentGatewayOption->fresh()), __('Billplz payment option updated.'));
    }

    public function destroy(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $this->ensureTypeMatch($request, $paymentGatewayOption);
        $paymentGatewayOption->delete();

        return $this->respond(null, __('Billplz payment option deleted.'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function transformOptionForApi(BillplzPaymentGatewayOption $option): array
    {
        $row = $option->toArray();
        $row['logo_url'] = $this->absolutePublicUrl($option->getAttributes()['logo_url'] ?? null);

        return $row;
    }

    protected function absolutePublicUrl(?string $stored): ?string
    {
        if ($stored === null || $stored === '') {
            return null;
        }

        $stored = trim((string) $stored);
        if (preg_match('#^https?://#i', $stored)) {
            return $stored;
        }

        return url('/'.ltrim($stored, '/'));
    }

    protected function defaultLogoPathForCode(string $code): ?string
    {
        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '', $code);
        if ($safe === '') {
            return null;
        }

        $relative = 'images/banks/'.$safe.'.svg';
        if (file_exists(public_path($relative))) {
            return '/'.$relative;
        }

        return null;
    }

    protected function storeUploadedLogo(UploadedFile $file, string $code): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: 'png');
        $safeCode = preg_replace('/[^a-zA-Z0-9_-]/', '_', $code) ?: 'bank';
        $name = $safeCode.'_'.Str::lower(Str::random(10)).'.'.$ext;
        $dir = public_path('images/banks');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $file->move($dir, $name);

        return '/images/banks/'.$name;
    }

    protected function validatePayload(Request $request, ?BillplzPaymentGatewayOption $option, string $type): array
    {
        $isUpdate = $option !== null;

        return $request->validate([
            'gateway_group' => [$isUpdate ? 'sometimes' : 'required', 'string', Rule::in(['online_banking', 'credit_card'])],
            'code' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:100',
                Rule::unique('billplz_payment_gateway_options', 'code')
                    ->where(fn ($q) => $q
                        ->where('type', $type)
                        ->where('gateway_group', (string) $request->input('gateway_group', $option?->gateway_group)))
                    ->ignore($option?->id),
            ],
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:150'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'file', 'max:4096', 'mimes:svg,png,jpg,jpeg,webp'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'meta' => ['nullable', 'array'],
        ]);
    }

    protected function unsetOtherDefaults(int $id, string $type, string $group): void
    {
        BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $group)
            ->where('id', '!=', $id)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    protected function ensureTypeMatch(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption): string
    {
        $type = WorkspaceType::fromRequest($request, $paymentGatewayOption->type ?: WorkspaceType::ECOMMERCE);
        abort_unless($paymentGatewayOption->type === $type, 404);

        return $type;
    }
}
