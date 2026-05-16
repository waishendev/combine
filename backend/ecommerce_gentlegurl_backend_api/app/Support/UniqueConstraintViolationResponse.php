<?php

namespace App\Support;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;

class UniqueConstraintViolationResponse
{
    public static function toJsonResponse(UniqueConstraintViolationException $e): JsonResponse
    {
        $parsed = self::parse($e);

        return response()->json([
            'success' => false,
            'message' => $parsed['message'],
            'errors' => $parsed['errors'],
            'data' => null,
        ], 422);
    }

    /**
     * @return array{message: string, errors: array<string, list<string>>}
     */
    public static function parse(UniqueConstraintViolationException $e): array
    {
        $detail = $e->getMessage();
        $constraint = '';
        $column = '';
        $value = '';

        if (preg_match('/unique constraint "([^"]+)"/i', $detail, $matches)) {
            $constraint = $matches[1];
        }

        if (preg_match('/Key \(([^)]+)\)=\(([^)]*)\)/', $detail, $matches)) {
            $column = $matches[1];
            $value = $matches[2];
        }

        $field = self::constraintToField($constraint, $column);
        $message = self::buildMessage($field, $value, $constraint);
        $errors = $field !== null ? [$field => [$message]] : [];

        return [
            'message' => $message,
            'errors' => $errors,
        ];
    }

    private static function constraintToField(string $constraint, string $column): ?string
    {
        if (str_contains($constraint, 'product_variants_sku') || ($column === 'sku' && str_contains($constraint, 'variant'))) {
            return 'variants.0.sku';
        }

        if (str_contains($constraint, 'products_sku_unique') || ($column === 'sku' && str_contains($constraint, 'products'))) {
            return 'sku';
        }

        if (str_contains($constraint, 'products_slug') || $column === 'slug') {
            return 'slug';
        }

        if (str_contains($constraint, 'products_barcode') || ($column === 'barcode' && str_contains($constraint, 'products'))) {
            return 'barcode';
        }

        if (str_contains($constraint, 'product_variants_barcode') || ($column === 'barcode' && str_contains($constraint, 'variant'))) {
            return 'variants.0.barcode';
        }

        return $column !== '' ? $column : null;
    }

    private static function buildMessage(?string $field, string $value, string $constraint): string
    {
        $valueLabel = $value !== '' ? ' "'.$value.'"' : '';

        if (
            str_contains($constraint, 'product_variants_sku')
            || $field === 'variants.0.sku'
        ) {
            return $value !== ''
                ? 'SKU'.$valueLabel.' is already used by another product variant. Each variant SKU must be unique across all products.'
                : 'This variant SKU is already used by another product variant.';
        }

        if ($field === 'sku') {
            return $value !== ''
                ? 'SKU'.$valueLabel.' is already used by another product.'
                : 'This product SKU is already in use.';
        }

        if ($field === 'slug') {
            return $value !== ''
                ? 'Slug'.$valueLabel.' is already in use.'
                : 'This slug is already in use.';
        }

        if ($field === 'barcode' || str_contains($constraint, 'barcode')) {
            return $value !== ''
                ? 'Barcode'.$valueLabel.' is already in use.'
                : 'This barcode is already in use.';
        }

        return 'A duplicate value was submitted. Please check SKU, barcode, or slug and try again.';
    }
}
