<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerDepositWaiverLog;
use App\Models\Ecommerce\LoyaltySetting;
use App\Models\Ecommerce\MembershipTierRule;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\CustomerAddress;
use App\Models\Ecommerce\CustomerVoucher;
use App\Models\Ecommerce\PointsRedemptionItem;
use App\Models\Ecommerce\PointsTransaction;
use App\Models\Ecommerce\Voucher;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = $request->string('search')->toString();
        $loyaltySetting = $this->getActiveLoyaltySetting();
        $tierRules = $this->getActiveTierRules();
        $window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);

        $customers = Customer::when($search, function ($query) use ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhereHas('customerType', fn($typeQuery) => $typeQuery->where('name', 'like', "%{$search}%"));
            });
        })->paginate($perPage)->through(function ($customer) use ($loyaltySetting, $tierRules, $window) {
            return $this->formatCustomerWithSummary($customer, $loyaltySetting, $tierRules, $window);
        });

        return $this->respond($customers);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:customers,phone'],
            'password' => ['nullable', 'string', 'min:6'],
            'customer_type_id' => ['nullable', 'integer', 'exists:customer_types,id'],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'avatar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date'],
        ]);

        $data = $validated;
        // Generate a random password if none is provided
        if (empty($data['password'])) {
            $data['password'] = \Illuminate\Support\Str::random(12);
        }
        
        $customer = Customer::create($data + [
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return $this->respond($customer, __('Customer created successfully.'));
    }

    public function show(Customer $customer)
    {
        $loyaltySetting = $this->getActiveLoyaltySetting();
        $tierRules = $this->getActiveTierRules();
        $window = $this->getWindowDates($loyaltySetting?->evaluation_cycle_months ?? 6);

        return $this->respond($this->formatCustomerWithDetails($customer, $loyaltySetting, $tierRules, $window));
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($customer->id)],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique('customers', 'phone')->ignore($customer->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'customer_type_id' => ['nullable', 'integer', 'exists:customer_types,id'],
            'tier' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'tier_marked_pending_at' => ['nullable', 'date'],
            'tier_effective_at' => ['nullable', 'date'],
            'avatar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date'],
        ]);

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $customer->fill($validated);
        $customer->save();

        return $this->respond($customer, __('Customer updated successfully.'));
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return $this->respond(null, __('Customer deleted successfully.'));
    }

    public function toggleDepositWaiver(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'allow_booking_without_deposit' => ['required', 'boolean'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $nextValue = (bool) $validated['allow_booking_without_deposit'];
        $beforeValue = (bool) ($customer->allow_booking_without_deposit ?? false);
        $remark = isset($validated['remark']) ? trim((string) $validated['remark']) : null;

        if ($beforeValue === $nextValue) {
            return $this->respond($customer, __('Deposit waiver setting unchanged.'));
        }

        DB::transaction(function () use ($customer, $beforeValue, $nextValue, $remark, $request) {
            $customer->forceFill([
                'allow_booking_without_deposit' => $nextValue,
            ])->save();

            CustomerDepositWaiverLog::query()->create([
                'customer_id' => (int) $customer->id,
                'action_type' => $nextValue ? 'enable_deposit_waiver' : 'disable_deposit_waiver',
                'before_value' => [
                    'allow_booking_without_deposit' => $beforeValue,
                ],
                'after_value' => [
                    'allow_booking_without_deposit' => $nextValue,
                ],
                'remark' => $remark !== '' ? $remark : null,
                'created_by' => $request->user()?->id,
            ]);
        });

        return $this->respond(
            $this->formatCustomerWithDetails(
                $customer->fresh(),
                $this->getActiveLoyaltySetting(),
                $this->getActiveTierRules(),
                $this->getWindowDates($this->getActiveLoyaltySetting()?->evaluation_cycle_months ?? 6),
            ),
            __('Deposit waiver setting updated successfully.'),
        );
    }

    public function exportCsv(Request $request)
    {
        $customers = Customer::query()
            ->with(['customerType', 'addresses', 'customerVouchers.voucher'])
            ->orderBy('id')
            ->get();

        $rows = $customers->map(function (Customer $customer) {
            $payload = $customer->toArray();
            $payload['type'] = $customer->customerType?->name;
            unset($payload['password'], $payload['remember_token']);

            $payload['member_points'] = $this->getAvailablePoints($customer);
            $payload['addresses'] = $customer->addresses
                ->map(function (CustomerAddress $address) {
                    return [
                        'label' => $address->label,
                        'type' => $address->type,
                        'name' => $address->name,
                        'phone' => $address->phone,
                        'line1' => $address->line1,
                        'line2' => $address->line2,
                        'city' => $address->city,
                        'state' => $address->state,
                        'postcode' => $address->postcode,
                        'country' => $address->country,
                        'is_default' => (bool) $address->is_default,
                    ];
                })
                ->all();

            $payload['vouchers'] = $customer->customerVouchers
                ->map(function (CustomerVoucher $customerVoucher) {
                    return [
                        'voucher_id' => $customerVoucher->voucher_id,
                        'voucher_code' => $customerVoucher->voucher?->code,
                        'quantity_total' => $customerVoucher->quantity_total,
                        'quantity_used' => $customerVoucher->quantity_used,
                        'status' => $customerVoucher->status,
                        'claimed_at' => optional($customerVoucher->claimed_at)->format('Y-m-d H:i:s'),
                        'used_at' => optional($customerVoucher->used_at)->format('Y-m-d H:i:s'),
                        'start_at' => optional($customerVoucher->start_at)->format('Y-m-d H:i:s'),
                        'end_at' => optional($customerVoucher->end_at)->format('Y-m-d H:i:s'),
                        'expires_at' => optional($customerVoucher->expires_at)->format('Y-m-d H:i:s'),
                        'note' => $customerVoucher->note,
                    ];
                })
                ->values()
                ->all();

            return $payload;
        })->values()->all();

        $headers = [];
        foreach ($rows as $row) {
            foreach (array_keys($row) as $key) {
                if (! in_array($key, $headers, true)) {
                    $headers[] = $key;
                }
            }
        }

        if (empty($headers)) {
            $headers = [
                'id', 'name', 'email', 'phone', 'customer_type_id', 'type', 'tier', 'tier_marked_pending_at', 'tier_effective_at',
                'is_active', 'last_login_at', 'last_login_ip', 'avatar', 'gender', 'date_of_birth',
                'email_verified_at', 'member_points', 'addresses', 'vouchers', 'created_at', 'updated_at',
            ];
        }

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json([
                'message' => 'Unable to build customer CSV export.',
            ], 500);
        }

        fputcsv($stream, $headers);

        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $header) {
                $value = $row[$header] ?? null;
                if (is_array($value) || is_object($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
                $line[] = $value;
            }
            fputcsv($stream, $line);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        $csv = mb_convert_encoding($csv, 'UTF-8', 'UTF-8');
        $csv = "\xEF\xBB\xBF" . $csv;

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="customers_export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $file = $validated['file'];
        $handle = fopen($file->getRealPath(), 'r');

        if (! $handle) {
            return response()->json([
                'message' => 'Unable to open CSV file.',
            ], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json([
                'message' => 'Invalid CSV header row.',
            ], 422);
        }

        $headers = array_map(function ($header) {
            return trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header));
        }, $headers);

        $allowedFields = [
            'name', 'email', 'phone', 'password', 'customer_type_id', 'tier', 'tier_marked_pending_at', 'tier_effective_at',
            'is_active', 'last_login_at', 'last_login_ip', 'avatar', 'gender', 'date_of_birth',
            'email_verified_at', 'member_points', 'addresses', 'vouchers', 'type',
        ];

        $summary = [
            'totalRows' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0,
            'failedRows' => [],
        ];

        $rowNumber = 1;
        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $isAllEmpty = count(array_filter($cells, fn($value) => trim((string) $value) !== '')) === 0;
            if ($isAllEmpty) {
                continue;
            }

            $summary['totalRows']++;

            $raw = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }

                $raw[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            $payload = [];
            foreach ($allowedFields as $field) {
                if (! array_key_exists($field, $raw)) {
                    continue;
                }

                $value = $raw[$field];
                if ($value === '') {
                    $payload[$field] = null;
                    continue;
                }

                if (in_array($field, ['is_active'], true)) {
                    $normalized = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                    $payload[$field] = $normalized ?? false;
                    continue;
                }

                $payload[$field] = $value;
            }

            $memberPoints = null;
            if (array_key_exists('member_points', $payload) && $payload['member_points'] !== null) {
                if (! is_numeric($payload['member_points'])) {
                    $summary['failed']++;
                    $summary['failedRows'][] = [
                        'row' => $rowNumber,
                        'reason' => 'member_points must be a number.',
                    ];
                    continue;
                }

                $memberPoints = max((int) $payload['member_points'], 0);
                unset($payload['member_points']);
            }

            $addressPayload = [];
            $addressesProvided = false;
            if (array_key_exists('addresses', $payload)) {
                $addressesProvided = true;
                $rawAddresses = $payload['addresses'];
                unset($payload['addresses']);

                if ($rawAddresses !== null) {
                    $decodedAddresses = json_decode((string) $rawAddresses, true);
                    if (! is_array($decodedAddresses)) {
                        $summary['failed']++;
                        $summary['failedRows'][] = [
                            'row' => $rowNumber,
                            'reason' => 'addresses must be a valid JSON array.',
                        ];
                        continue;
                    }

                    $addressPayload = array_values(array_filter(array_map(function ($address) {
                        if (! is_array($address)) {
                            return null;
                        }

                        $normalizeBool = function ($value) {
                            if (is_bool($value)) {
                                return $value;
                            }

                            $normalized = filter_var((string) $value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                            return $normalized ?? false;
                        };

                        return [
                            'label' => isset($address['label']) ? trim((string) $address['label']) : null,
                            'type' => isset($address['type']) ? trim((string) $address['type']) : 'shipping',
                            'name' => isset($address['name']) ? trim((string) $address['name']) : null,
                            'phone' => isset($address['phone']) ? trim((string) $address['phone']) : null,
                            'line1' => isset($address['line1']) ? trim((string) $address['line1']) : null,
                            'line2' => isset($address['line2']) ? trim((string) $address['line2']) : null,
                            'city' => isset($address['city']) ? trim((string) $address['city']) : null,
                            'state' => isset($address['state']) ? trim((string) $address['state']) : null,
                            'postcode' => isset($address['postcode']) ? trim((string) $address['postcode']) : null,
                            'country' => isset($address['country']) ? trim((string) $address['country']) : null,
                            'is_default' => $normalizeBool($address['is_default'] ?? false),
                        ];
                    }, $decodedAddresses), fn($address) => is_array($address)));
                }
            }

            $voucherPayload = [];
            $vouchersProvided = false;
            if (array_key_exists('vouchers', $payload)) {
                $vouchersProvided = true;
                $rawVouchers = $payload['vouchers'];
                unset($payload['vouchers']);

                if ($rawVouchers !== null) {
                    $decodedVouchers = json_decode((string) $rawVouchers, true);
                    if (! is_array($decodedVouchers)) {
                        $summary['failed']++;
                        $summary['failedRows'][] = [
                            'row' => $rowNumber,
                            'reason' => 'vouchers must be a valid JSON array.',
                        ];
                        continue;
                    }

                    $voucherPayload = array_values(array_filter(array_map(function ($voucherItem) {
                        if (! is_array($voucherItem)) {
                            return null;
                        }

                        return [
                            'voucher_id' => $voucherItem['voucher_id'] ?? null,
                            'voucher_code' => isset($voucherItem['voucher_code']) ? trim((string) $voucherItem['voucher_code']) : null,
                            'quantity_total' => isset($voucherItem['quantity_total']) ? max((int) $voucherItem['quantity_total'], 1) : 1,
                            'quantity_used' => isset($voucherItem['quantity_used']) ? max((int) $voucherItem['quantity_used'], 0) : 0,
                            'status' => isset($voucherItem['status']) ? trim((string) $voucherItem['status']) : 'active',
                            'claimed_at' => $voucherItem['claimed_at'] ?? null,
                            'used_at' => $voucherItem['used_at'] ?? null,
                            'start_at' => $voucherItem['start_at'] ?? null,
                            'end_at' => $voucherItem['end_at'] ?? null,
                            'expires_at' => $voucherItem['expires_at'] ?? null,
                            'note' => isset($voucherItem['note']) ? trim((string) $voucherItem['note']) : null,
                        ];
                    }, $decodedVouchers), fn($voucherItem) => is_array($voucherItem)));
                }
            }

            $email = trim((string) ($payload['email'] ?? ''));
            if ($email === '') {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => 'Missing required email field.',
                ];
                continue;
            }

            $name = trim((string) ($payload['name'] ?? ''));
            if ($name === '') {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => 'Missing required name field.',
                ];
                continue;
            }

            try {
                $customer = Customer::query()->where('email', $email)->first();
                $isCreating = ! $customer;

                if ($isCreating) {
                    $customer = new Customer();
                    if (empty($payload['password'])) {
                        $payload['password'] = Str::random(12);
                    }
                } else {
                    if (empty($payload['password'])) {
                        unset($payload['password']);
                    }
                }

                if (array_key_exists('phone', $payload) && $payload['phone'] !== null) {
                    $phoneConflict = Customer::query()
                        ->where('phone', $payload['phone'])
                        ->when($customer->exists, fn($query) => $query->where('id', '!=', $customer->id))
                        ->exists();

                    if ($phoneConflict) {
                        throw new \RuntimeException('Phone already exists.');
                    }
                }

                if (! array_key_exists('is_active', $payload) || $payload['is_active'] === null) {
                    $payload['is_active'] = $customer->exists ? $customer->is_active : true;
                }

                if (! array_key_exists('tier', $payload) || empty((string) $payload['tier'])) {
                    $payload['tier'] = $this->resolveTierByPoints($memberPoints ?? $this->getAvailablePoints($customer));
                }

                $customer->fill($payload);
                $customer->email = $email;
                $customer->name = $name;
                $customer->save();

                if ($addressesProvided) {
                    $customer->addresses()->delete();
                    foreach ($addressPayload as $addressData) {
                        $customer->addresses()->create($addressData);
                    }
                }

                if ($vouchersProvided) {
                    $customer->customerVouchers()->delete();

                    foreach ($voucherPayload as $voucherData) {
                        $voucher = null;
                        if (! empty($voucherData['voucher_code'])) {
                            $voucher = Voucher::query()->where('code', $voucherData['voucher_code'])->first();
                        }

                        if (! $voucher && ! empty($voucherData['voucher_id'])) {
                            $voucher = Voucher::query()->find($voucherData['voucher_id']);
                        }

                        if (! $voucher) {
                            throw new \RuntimeException('Voucher not found for one of voucher rows.');
                        }

                        $customer->customerVouchers()->create([
                            'voucher_id' => $voucher->id,
                            'quantity_total' => max((int) $voucherData['quantity_total'], 1),
                            'quantity_used' => max((int) $voucherData['quantity_used'], 0),
                            'status' => $voucherData['status'] ?: 'active',
                            'claimed_at' => $voucherData['claimed_at'] ?? Carbon::now(),
                            'used_at' => $voucherData['used_at'] ?? null,
                            'start_at' => $voucherData['start_at'] ?? null,
                            'end_at' => $voucherData['end_at'] ?? null,
                            'expires_at' => $voucherData['expires_at'] ?? null,
                            'note' => $voucherData['note'] ?? null,
                        ]);
                    }
                }

                if ($memberPoints !== null) {
                    $this->replaceMemberPoints($customer, $memberPoints);
                }

                if ($isCreating) {
                    $summary['created']++;
                } else {
                    $summary['updated']++;
                }
            } catch (\Throwable $exception) {
                $summary['failed']++;
                $summary['failedRows'][] = [
                    'row' => $rowNumber,
                    'reason' => $exception->getMessage(),
                ];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'Customer CSV import finished.');
    }

    public function verifyEmail(Customer $customer)
    {
        if ($customer->hasVerifiedEmail()) {
            return $this->respond($customer, __('Customer email already verified.'));
        }

        $customer->markEmailAsVerified();
        event(new Verified($customer));

        return $this->respond($customer, __('Customer email verified successfully.'));
    }


    protected function replaceMemberPoints(Customer $customer, int $points): void
    {
        PointsEarnBatch::query()->where('customer_id', $customer->id)->delete();
        PointsTransaction::query()->where('customer_id', $customer->id)->delete();

        if ($points <= 0) {
            return;
        }

        $now = Carbon::now();

        PointsEarnBatch::query()->create([
            'customer_id' => $customer->id,
            'points_total' => $points,
            'points_remaining' => $points,
            'source_type' => 'csv_import',
            'source_id' => null,
            'earned_at' => $now,
            'expires_at' => $now->copy()->addYears(10),
        ]);

        PointsTransaction::query()->create([
            'customer_id' => $customer->id,
            'type' => 'earn',
            'points_change' => $points,
            'source_type' => 'csv_import',
            'source_id' => null,
            'meta' => [
                'reason' => 'member points initialized by customer csv import',
            ],
        ]);
    }

    protected function resolveTierByPoints(int $points): string
    {
        $tierRules = MembershipTierRule::query()
            ->where('is_active', true)
            ->orderBy('min_spent_last_x_months')
            ->get();

        if ($tierRules->isEmpty()) {
            return 'basic';
        }

        $selectedTier = $tierRules->first()->tier;
        foreach ($tierRules as $rule) {
            if ($points >= (int) round((float) $rule->min_spent_last_x_months)) {
                $selectedTier = $rule->tier;
            }
        }

        return $selectedTier;
    }

    protected function formatCustomerWithSummary(Customer $customer, ?LoyaltySetting $loyaltySetting, $tierRules, array $window)
    {
        $availablePoints = $this->getAvailablePoints($customer);
        $spentInWindow = $this->getSpentInWindow($customer, $window['start'], $window['end']);
        $nextTierData = $this->calculateNextTier($customer, $tierRules, $spentInWindow);

        return $customer->toArray() + [
            'available_points' => $availablePoints,
            'spent_in_window' => $spentInWindow,
            'next_tier' => $nextTierData['tier'],
            'amount_to_next_tier' => $nextTierData['amount_to_reach'],
        ];
    }

    protected function formatCustomerWithDetails(Customer $customer, ?LoyaltySetting $loyaltySetting, $tierRules, array $window)
    {
        $availablePoints = $this->getAvailablePoints($customer);
        $spentInWindow = $this->getSpentInWindow($customer, $window['start'], $window['end']);
        $nextTierData = $this->calculateNextTier($customer, $tierRules, $spentInWindow);
        $latestDepositWaiverLog = CustomerDepositWaiverLog::query()
            ->with('creator:id,name')
            ->where('customer_id', $customer->id)
            ->latest('id')
            ->first();

        return $customer->toArray() + [
            'latest_deposit_waiver_log' => $latestDepositWaiverLog ? [
                'id' => (int) $latestDepositWaiverLog->id,
                'action_type' => (string) $latestDepositWaiverLog->action_type,
                'remark' => $latestDepositWaiverLog->remark,
                'created_at' => optional($latestDepositWaiverLog->created_at)?->toDateTimeString(),
                'created_by' => $latestDepositWaiverLog->creator ? [
                    'id' => (int) $latestDepositWaiverLog->creator->id,
                    'name' => (string) $latestDepositWaiverLog->creator->name,
                ] : null,
            ] : null,
            'loyalty_summary' => [
                'available_points' => $availablePoints,
                'total_earned' => $this->getTotalEarnedPoints($customer),
                'total_redeemed' => $this->getTotalRedeemedPoints($customer),
                'window' => [
                    'months_window' => $window['months'],
                    'start_date' => $window['start']->toDateString(),
                    'end_date' => $window['end']->toDateString(),
                    'spent_in_window' => $spentInWindow,
                ],
                'next_tier' => $nextTierData['detail'],
            ],
        ];
    }

    protected function getActiveLoyaltySetting(): ?LoyaltySetting
    {
        return LoyaltySetting::where(function ($query) {
            $query->whereNull('rules_effective_at')
                ->orWhere('rules_effective_at', '<=', Carbon::now()->toDateString());
        })
            ->orderByDesc('rules_effective_at')
            ->orderByDesc('created_at')
            ->first();
    }

    protected function getActiveTierRules()
    {
        return MembershipTierRule::where('is_active', true)
            ->orderBy('min_spent_last_x_months')
            ->get();
    }

    protected function getWindowDates(int $months): array
    {
        $end = Carbon::now()->endOfDay();
        $start = Carbon::now()->subMonths($months)->startOfDay();

        return [
            'months' => $months,
            'start' => $start,
            'end' => $end,
        ];
    }

    protected function getAvailablePoints(Customer $customer): int
    {
        return (int) PointsEarnBatch::where('customer_id', $customer->id)
            ->where('points_remaining', '>', 0)
            ->where('expires_at', '>', Carbon::now())
            ->sum('points_remaining');
    }

    protected function getTotalEarnedPoints(Customer $customer): int
    {
        return (int) PointsEarnBatch::where('customer_id', $customer->id)
            ->sum('points_total');
    }

    protected function getTotalRedeemedPoints(Customer $customer): int
    {
        return (int) PointsRedemptionItem::whereHas('redemption', function ($query) use ($customer) {
            $query->where('customer_id', $customer->id);
        })->sum('points_used');
    }

    protected function getSpentInWindow(Customer $customer, Carbon $startDate, Carbon $endDate): float
    {
        return (float) Order::where('customer_id', $customer->id)
            ->whereIn('status', ['paid', 'completed'])
            ->whereBetween('created_at', [$startDate, $endDate])
            ->sum('grand_total');
    }

    protected function calculateNextTier(Customer $customer, $tierRules, float $spentInWindow): array
    {
        $tierRules = $tierRules->values();
        $currentIndex = $tierRules->search(function ($rule) use ($customer) {
            return $rule->tier === $customer->tier;
        });

        $nextRule = null;
        if ($currentIndex !== false && $currentIndex < ($tierRules->count() - 1)) {
            $nextRule = $tierRules[$currentIndex + 1];
        } elseif ($currentIndex === false) {
            $nextRule = $tierRules->firstWhere(function ($rule) use ($spentInWindow) {
                return $rule->min_spent_last_x_months > $spentInWindow;
            });
        }

        if (!$nextRule) {
            return [
                'tier' => null,
                'amount_to_reach' => null,
                'detail' => null,
            ];
        }

        $amountToReach = max($nextRule->min_spent_last_x_months - $spentInWindow, 0);

        return [
            'tier' => $nextRule->tier,
            'amount_to_reach' => $amountToReach > 0 ? $amountToReach : null,
            'detail' => [
                'tier' => $nextRule->tier,
                'threshold_amount' => $nextRule->min_spent_last_x_months,
                'amount_to_reach' => $amountToReach,
            ],
        ];
    }
}
