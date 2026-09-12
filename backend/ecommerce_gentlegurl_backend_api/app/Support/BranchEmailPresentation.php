<?php

namespace App\Support;

use App\Models\Ecommerce\StoreLocation;

class BranchEmailPresentation
{
    public static function from(?StoreLocation $branch): ?array
    {
        if (! $branch) return null;

        return [
            'name' => (string) $branch->name,
            'address' => collect([
                $branch->address_line1, $branch->address_line2,
                collect([$branch->postcode, $branch->city])->filter()->implode(' '),
                $branch->state, $branch->country,
            ])->filter(fn ($line) => trim((string) $line) !== '')->implode("\n"),
            'phone' => filled($branch->phone) ? (string) $branch->phone : null,
        ];
    }
}
