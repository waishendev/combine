<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestion;
use App\Models\Booking\BookingServiceQuestionOption;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingServiceProductLinkService
{
    public function __construct(
        private readonly BookingServiceCategoryProductLinkService $categoryProductLinkService,
    ) {
    }

    /** @var list<string> */
    private array $copiedImagePaths = [];

    /** @var list<string> */
    private array $pendingDeletedImagePaths = [];

    public function discardCopiedImagePaths(): void
    {
        $this->copiedImagePaths = [];
    }

    public function commitFileCleanup(): void
    {
        foreach ($this->pendingDeletedImagePaths as $path) {
            $normalized = ltrim($path, '/');
            if ($normalized !== '' && Storage::disk('public')->exists($normalized)) {
                Storage::disk('public')->delete($normalized);
            }
        }

        $this->pendingDeletedImagePaths = [];
        $this->copiedImagePaths = [];
    }

    public function cleanupCopiedImagePaths(): void
    {
        foreach ($this->copiedImagePaths as $path) {
            $normalized = ltrim($path, '/');
            if ($normalized !== '' && Storage::disk('public')->exists($normalized)) {
                Storage::disk('public')->delete($normalized);
            }
        }

        $this->copiedImagePaths = [];
        $this->pendingDeletedImagePaths = [];
    }
    public function createProductFromService(BookingService $service): BookingProduct
    {
        $service->loadMissing('questions.options.linkedBookingService');

        $payload = $this->buildProductPayloadFromService($service);
        $payload['image_path'] = $this->copyImageForProduct($service->image_path);

        $product = BookingProduct::query()->create($payload);
        $this->syncQuestionsFromService($service, $product);
        $this->syncProductCategoriesFromService($service, $product);

        return $product->fresh(['questions.options', 'categories']);
    }

    public function syncProductFromService(BookingService $service, BookingProduct $product): BookingProduct
    {
        $service->loadMissing('questions.options.linkedBookingService');

        $payload = $this->buildProductPayloadFromService($service);
        $newImagePath = $this->copyImageForProduct($service->image_path);
        $oldImagePath = $product->image_path;

        if ($newImagePath !== null) {
            $payload['image_path'] = $newImagePath;
        }

        $product->update($payload);
        $this->syncQuestionsFromService($service, $product);
        $this->syncProductCategoriesFromService($service, $product);

        if ($newImagePath !== null && $oldImagePath && $oldImagePath !== $newImagePath) {
            $this->pendingDeletedImagePaths[] = $oldImagePath;
        }

        return $product->fresh(['questions.options', 'categories']);
    }

    public function assignProductLink(BookingService $service, ?int $productId): void
    {
        if ($productId === null || $productId <= 0) {
            $service->update(['linked_booking_product_id' => null]);

            return;
        }

        if (! BookingProduct::query()->whereKey($productId)->exists()) {
            throw ValidationException::withMessages([
                'linked_booking_product_id' => ['Selected booking product does not exist.'],
            ]);
        }

        BookingService::query()
            ->where('linked_booking_product_id', $productId)
            ->where('id', '!=', $service->id)
            ->update(['linked_booking_product_id' => null]);

        $service->update(['linked_booking_product_id' => $productId]);
    }

    public function handleCreateLink(BookingService $service, bool $createLinkedProduct, ?int $linkedProductId): void
    {
        if ($createLinkedProduct && $linkedProductId) {
            throw ValidationException::withMessages([
                'linked_booking_product_id' => ['Choose either create linked product or link an existing product, not both.'],
            ]);
        }

        if ($createLinkedProduct) {
            $product = $this->createProductFromService($service->fresh([
                'categories:id,name,cn_name',
                'questions.options.linkedBookingService',
            ]));
            $this->assignProductLink($service, (int) $product->id);

            return;
        }

        if ($linkedProductId) {
            $this->assignProductLink($service, $linkedProductId);
        }
    }

    public function handleUpdateLink(
        BookingService $service,
        bool $unlinkBookingProduct,
        bool $createLinkedProduct,
        ?int $linkedProductId,
        bool $hasLinkedProductIdInput,
    ): void {
        if ($unlinkBookingProduct) {
            $service->update(['linked_booking_product_id' => null]);

            return;
        }

        if ($createLinkedProduct) {
            if ($linkedProductId || $hasLinkedProductIdInput) {
                throw ValidationException::withMessages([
                    'create_linked_product' => ['Choose either create linked product or link an existing product, not both.'],
                ]);
            }

            $product = $this->createProductFromService($service->fresh([
                'categories:id,name,cn_name',
                'questions.options.linkedBookingService',
            ]));
            $this->assignProductLink($service, (int) $product->id);

            return;
        }

        if ($hasLinkedProductIdInput) {
            $this->assignProductLink($service, $linkedProductId);
        }
    }

    public function deleteLinkedProductIfRequested(BookingService $service, bool $deleteLinkedProduct): void
    {
        if (! $deleteLinkedProduct) {
            return;
        }

        $productId = $service->linked_booking_product_id;
        if (! $productId) {
            return;
        }

        $service->update(['linked_booking_product_id' => null]);
        BookingProduct::query()->whereKey($productId)->delete();
    }

    public function formatLinkedProduct(?BookingProduct $product): ?array
    {
        if (! $product) {
            return null;
        }

        return [
            'id' => (int) $product->id,
            'name' => (string) $product->name,
            'cn_name' => $product->cn_name,
            'price' => (float) $product->price,
            'price_mode' => (string) ($product->price_mode ?? 'fixed'),
            'price_range_min' => $product->price_range_min !== null ? (float) $product->price_range_min : null,
            'price_range_max' => $product->price_range_max !== null ? (float) $product->price_range_max : null,
            'is_active' => (bool) $product->is_active,
            'image_url' => $product->image_url,
        ];
    }

    private function buildProductPayloadFromService(BookingService $service): array
    {
        $priceMode = ($service->price_mode ?? 'fixed') === 'range' ? 'range' : 'fixed';

        $payload = [
            'name' => (string) $service->name,
            'cn_name' => $service->cn_name,
            'description' => $service->description,
            'price_mode' => $priceMode,
            'is_active' => (bool) $service->is_active,
        ];

        if ($priceMode === 'range') {
            $min = round((float) ($service->price_range_min ?? $service->service_price ?? 0), 2);
            $max = round((float) ($service->price_range_max ?? $min), 2);
            $payload['price_range_min'] = $min;
            $payload['price_range_max'] = $max;
            $payload['price'] = $min;
        } else {
            $price = round((float) ($service->service_price ?? $service->price ?? 0), 2);
            $payload['price'] = $price;
            $payload['price_range_min'] = null;
            $payload['price_range_max'] = null;
        }

        return $payload;
    }

    private function copyImageForProduct(?string $sourcePath): ?string
    {
        if (! $sourcePath) {
            return null;
        }

        if (filter_var($sourcePath, FILTER_VALIDATE_URL)) {
            return $sourcePath;
        }

        $normalized = ltrim($sourcePath, '/');
        if (! Storage::disk('public')->exists($normalized)) {
            return null;
        }

        $extension = pathinfo($normalized, PATHINFO_EXTENSION) ?: 'jpg';
        $targetPath = sprintf(
            'booking/product-images/%s-%s.%s',
            now()->format('YmdHis'),
            Str::uuid(),
            $extension
        );

        Storage::disk('public')->copy($normalized, $targetPath);
        $this->copiedImagePaths[] = $targetPath;

        return $targetPath;
    }

    private function syncProductCategoriesFromService(BookingService $service, BookingProduct $product): void
    {
        $product->categories()->sync($this->resolveProductCategoryIdsFromService($service));
    }

    /**
     * Map booking service categories to booking product categories by English + Chinese name.
     *
     * @return list<int>
     */
    private function resolveProductCategoryIdsFromService(BookingService $service): array
    {
        $service->loadMissing('categories');

        if ($service->categories->isEmpty()) {
            return [];
        }

        foreach ($service->categories as $serviceCategory) {
            $productCategoryId = $this->categoryProductLinkService->resolveProductCategoryId($serviceCategory);
            if ($productCategoryId) {
                $resolvedIds[] = $productCategoryId;
            }
        }

        return collect($resolvedIds)->unique()->values()->all();
    }

    private function syncQuestionsFromService(BookingService $service, BookingProduct $product): void
    {
        $product->questions()->delete();

        foreach ($service->questions as $questionIndex => $question) {
            if (! $question instanceof BookingServiceQuestion) {
                continue;
            }

            $productQuestion = $product->questions()->create([
                'title' => trim((string) $question->title),
                'cn_title' => trim((string) ($question->cn_title ?? '')) ?: null,
                'description' => trim((string) ($question->description ?? '')) ?: null,
                'cn_description' => trim((string) ($question->cn_description ?? '')) ?: null,
                'question_type' => in_array((string) $question->question_type, ['single_choice', 'multi_choice'], true)
                    ? (string) $question->question_type
                    : 'single_choice',
                'sort_order' => (int) ($question->sort_order ?? $questionIndex),
                'is_required' => (bool) $question->is_required,
                'is_active' => (bool) $question->is_active,
            ]);

            foreach ($question->options as $optionIndex => $option) {
                if (! $option instanceof BookingServiceQuestionOption) {
                    continue;
                }

                $fallbackLabel = trim((string) optional($option->linkedBookingService)->name);
                $fallbackCnLabel = trim((string) optional($option->linkedBookingService)->cn_name);
                $label = trim((string) ($option->label ?? '')) ?: $fallbackLabel;
                $cnLabel = trim((string) ($option->cn_label ?? '')) ?: $fallbackCnLabel;

                if ($label === '') {
                    continue;
                }

                $extraPrice = $option->linkedBookingService
                    ? max(0, (float) ($option->linkedBookingService->service_price ?? 0))
                    : max(0, (float) ($option->extra_price ?? 0));

                $productQuestion->options()->create([
                    'label' => $label,
                    'cn_label' => $cnLabel !== '' ? $cnLabel : null,
                    'extra_price' => $extraPrice,
                    'sort_order' => (int) ($option->sort_order ?? $optionIndex),
                    'is_active' => (bool) $option->is_active,
                ]);
            }
        }
    }
}
