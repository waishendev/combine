<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingProductCategory;
use App\Models\Booking\BookingServiceCategory;
use Illuminate\Validation\ValidationException;

class BookingServiceCategoryProductLinkService
{
    public function assignProductCategoryLink(BookingServiceCategory $serviceCategory, ?int $productCategoryId): void
    {
        if ($productCategoryId === null || $productCategoryId <= 0) {
            $serviceCategory->update(['linked_booking_product_category_id' => null]);

            return;
        }

        if (! BookingProductCategory::query()->whereKey($productCategoryId)->exists()) {
            throw ValidationException::withMessages([
                'linked_booking_product_category_id' => ['Selected product category does not exist.'],
            ]);
        }

        $serviceCategory->update(['linked_booking_product_category_id' => $productCategoryId]);
    }

    public function handleUpdateLink(
        BookingServiceCategory $serviceCategory,
        bool $unlinkProductCategory,
        bool $overwriteLinkedProductCategory,
        ?int $linkedProductCategoryId,
        bool $hasLinkedProductCategoryInput,
    ): void {
        if ($unlinkProductCategory) {
            $serviceCategory->update(['linked_booking_product_category_id' => null]);

            return;
        }

        if ($hasLinkedProductCategoryInput) {
            $this->assignProductCategoryLink($serviceCategory, $linkedProductCategoryId);
        }

        if ($overwriteLinkedProductCategory) {
            $serviceCategory = $serviceCategory->fresh();
            $this->syncLinkedProductCategory($serviceCategory);
        }
    }

    public function linkAfterCreate(BookingServiceCategory $serviceCategory): BookingProductCategory
    {
        $productCategory = BookingProductCategory::query()->create(
            $this->buildProductCategoryPayload($serviceCategory)
        );

        $serviceCategory->update([
            'linked_booking_product_category_id' => $productCategory->id,
        ]);

        return $productCategory;
    }

    public function syncLinkedProductCategory(BookingServiceCategory $serviceCategory): ?BookingProductCategory
    {
        $productCategory = $this->resolveLinkedProductCategory($serviceCategory);

        if (! $productCategory) {
            return $this->linkAfterCreate($serviceCategory);
        }

        $productCategory->update($this->buildProductCategoryPayload($serviceCategory));

        if (! $serviceCategory->linked_booking_product_category_id) {
            $serviceCategory->update([
                'linked_booking_product_category_id' => $productCategory->id,
            ]);
        }

        return $productCategory->fresh();
    }

    public function deleteLinkedProductCategory(BookingServiceCategory $serviceCategory): void
    {
        $productCategory = $this->resolveLinkedProductCategory($serviceCategory);

        if (! $productCategory) {
            return;
        }

        $productCategory->delete();
    }

    public function resolveProductCategoryId(BookingServiceCategory $serviceCategory): ?int
    {
        $productCategory = $this->resolveLinkedProductCategory($serviceCategory);

        return $productCategory ? (int) $productCategory->id : null;
    }

    public function resolveLinkedProductCategory(BookingServiceCategory $serviceCategory): ?BookingProductCategory
    {
        if ($serviceCategory->linked_booking_product_category_id) {
            return BookingProductCategory::query()->find($serviceCategory->linked_booking_product_category_id);
        }

        return $this->findProductCategoryByMatchKey($serviceCategory->name, $serviceCategory->cn_name);
    }

    public function buildCategoryMatchKey(?string $englishName, ?string $chineseName): string
    {
        $english = mb_strtolower(trim((string) $englishName));
        $chinese = trim((string) $chineseName);

        return $english.'||'.$chinese;
    }

    private function findProductCategoryByMatchKey(?string $englishName, ?string $chineseName): ?BookingProductCategory
    {
        $key = $this->buildCategoryMatchKey($englishName, $chineseName);
        $productCategories = BookingProductCategory::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'cn_name']);

        $matches = $productCategories
            ->filter(fn (BookingProductCategory $category) => $this->buildCategoryMatchKey($category->name, $category->cn_name) === $key)
            ->values();

        if ($matches->count() === 1) {
            return $matches->first();
        }

        if ($matches->count() > 1) {
            return $matches->first();
        }

        $english = mb_strtolower(trim((string) $englishName));
        $nameOnlyMatches = $productCategories
            ->filter(fn (BookingProductCategory $category) => mb_strtolower(trim((string) $category->name)) === $english)
            ->values();

        return $nameOnlyMatches->count() === 1 ? $nameOnlyMatches->first() : null;
    }

    /**
     * @return array{name: string, cn_name: ?string, sort_order: int, is_active: bool}
     */
    private function buildProductCategoryPayload(BookingServiceCategory $serviceCategory): array
    {
        return [
            'name' => (string) $serviceCategory->name,
            'cn_name' => $serviceCategory->cn_name,
            'sort_order' => (int) $serviceCategory->sort_order,
            'is_active' => (bool) $serviceCategory->is_active,
        ];
    }
}
