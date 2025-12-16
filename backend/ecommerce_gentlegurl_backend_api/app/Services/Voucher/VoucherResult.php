<?php

namespace App\Services\Voucher;

class VoucherResult
{
    public function __construct(
        public bool $valid,
        public ?string $error = null,
        public ?float $discountAmount = null,
        public ?array $voucherData = null,
    ) {
    }

    public static function invalid(string $error): self
    {
        return new self(false, $error, 0.0, null);
    }

    public static function valid(float $discountAmount, array $voucherData): self
    {
        return new self(true, null, $discountAmount, $voucherData);
    }
}
