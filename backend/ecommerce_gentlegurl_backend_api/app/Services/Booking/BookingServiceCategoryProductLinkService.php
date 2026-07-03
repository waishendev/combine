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
            $this->syncLinkedProductCategory($serviceCategory, true);
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

    /**
     * Update the linked product category from the service category.
     *
     * Only creates a new product category when $createIfMissing is true (explicit opt-in),
     * otherwise it just updates an already-linked product category and never fabricates one.
     */
    public function syncLinkedProductCategory(
        BookingServiceCategory $serviceCategory,
        bool $createIfMissing = false,
    ): ?BookingProductCategory {
        // Only trust the explicit FK link here; never guess by name during an update,
        // otherwise unrelated same-named product categories get overwritten or duplicated.
        $productCategory = $serviceCategory->linked_booking_product_category_id
            ? BookingProductCategory::query()->find($serviceCategory->linked_booking_product_category_id)
            : null;

        if (! $productCategory) {
            return $createIfMissing ? $this->linkAfterCreate($serviceCategory) : null;
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
        // Only delete the explicitly linked product category, never a name-matched guess.
        if (! $serviceCategory->linked_booking_product_category_id) {
            return;
        }

        $productCategory = BookingProductCategory::query()
            ->find($serviceCategory->linked_booking_product_category_id);

        $productCategory?->delete();
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

    public function findProductCategoryByNameMatch(?string $englishName, ?string $chineseName): ?BookingProductCategory
    {
        return $this->findProductCategoryByMatchKey($englishName, $chineseName);
    }

    /**
     * @return \Illuminate\Support\Collection<int, BookingProductCategory>
     */
    public function findProductCategoryNameMatches(?string $englishName, ?string $chineseName): \Illuminate\Support\Collection
    {
        $key = $this->buildCategoryMatchKey($englishName, $chineseName);
        $productCategories = BookingProductCategory::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'cn_name']);

        $fullMatches = $productCategories
            ->filter(fn (BookingProductCategory $category) => $this->buildCategoryMatchKey($category->name, $category->cn_name) === $key)
            ->values();

        if ($fullMatches->isNotEmpty()) {
            return $fullMatches;
        }

        $english = mb_strtolower(trim((string) $englishName));
        if ($english === '') {
            return collect();
        }

        return $productCategories
            ->filter(fn (BookingProductCategory $category) => mb_strtolower(trim((string) $category->name)) === $english)
            ->values();
    }

    private function findProductCategoryByMatchKey(?string $englishName, ?string $chineseName): ?BookingProductCategory
    {
        $matches = $this->findProductCategoryNameMatches($englishName, $chineseName);

        return $matches->count() === 1 ? $matches->first() : null;
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
