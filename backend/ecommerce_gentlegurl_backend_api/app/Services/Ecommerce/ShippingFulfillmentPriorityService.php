<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Setting;
use App\Services\SettingService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ShippingFulfillmentPriorityService
{
    /** @return Collection<int, int> */
    public function current(): Collection
    {
        return collect(SettingService::get(ShippingFulfillmentService::SETTING_KEY, [], 'ecommerce'))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
    }

    /** Append a newly-created Branch without changing the configured order. */
    public function append(StoreLocation $branch): bool
    {
        return DB::transaction(function () use ($branch): bool {
            $setting = $this->lockedSetting();
            $priority = $this->normalize($setting->value);

            if ($priority->contains((int) $branch->id)) {
                return false;
            }

            $setting->update(['value' => $priority->push((int) $branch->id)->all()]);

            return true;
        });
    }

    /**
     * Preview a legacy initialization/reconciliation. Existing order is sacred;
     * the named legacy Branch is first only when no configuration exists, and
     * every other missing Branch is appended in creation order.
     *
     * @return array{current:list<int>,proposed:list<int>,missing:list<int>,changed:bool}
     */
    public function preview(StoreLocation $legacyBranch): array
    {
        $current = $this->current();
        $branchIds = StoreLocation::query()->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id);
        $missing = $branchIds->diff($current)->values();
        $proposed = $current->isEmpty()
            ? collect([(int) $legacyBranch->id])->merge($branchIds->reject(fn ($id) => $id === (int) $legacyBranch->id))->values()
            : $current->merge($missing)->values();

        return [
            'current' => $current->all(),
            'proposed' => $proposed->all(),
            'missing' => $missing->all(),
            'changed' => $current->all() !== $proposed->all(),
        ];
    }

    /** Recalculate under a row lock so concurrent Branch creation cannot be lost. */
    public function reconcile(StoreLocation $legacyBranch): array
    {
        return DB::transaction(function () use ($legacyBranch): array {
            $setting = $this->lockedSetting();
            $current = $this->normalize($setting->value);
            $branchIds = StoreLocation::query()->orderBy('id')->pluck('id')->map(fn ($id) => (int) $id);
            $missing = $branchIds->diff($current)->values();
            $proposed = $current->isEmpty()
                ? collect([(int) $legacyBranch->id])->merge($branchIds->reject(fn ($id) => $id === (int) $legacyBranch->id))->values()
                : $current->merge($missing)->values();

            if ($current->all() !== $proposed->all()) {
                $setting->update(['value' => $proposed->all()]);
            }

            return ['current' => $current->all(), 'proposed' => $proposed->all(), 'missing' => $missing->all(), 'changed' => $current->all() !== $proposed->all()];
        });
    }

    private function lockedSetting(): Setting
    {
        $setting = Setting::query()->firstOrCreate(
            ['type' => 'ecommerce', 'key' => ShippingFulfillmentService::SETTING_KEY],
            ['value' => []],
        );

        return Setting::query()->whereKey($setting->id)->lockForUpdate()->firstOrFail();
    }

    /** @return Collection<int, int> */
    private function normalize(mixed $value): Collection
    {
        return collect(is_array($value) ? $value : [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();
    }
}
