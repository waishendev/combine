<?php

namespace App\Services\Voucher;

class VoucherResult
{
    public function __construct(
        public bool $valid,
        public ?string $error = null,
        public ?float $discountAmount = null,
        public ?array $voucherData = null,
        public ?int $customerVoucherId = null,
    ) {
    }

    public static function invalid(string $error): self
    {
        return new self(false, $error, 0.0, null, null);
    }

    public static function valid(float $discountAmount, array $voucherData, ?int $customerVoucherId = null): self
    {
        return new self(true, null, $discountAmount, $voucherData, $customerVoucherId);
    }
}
