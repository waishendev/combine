<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PageReview;
use App\Models\Ecommerce\ReviewPhoto;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

class PublicPageReviewController extends Controller
{
    use ResolvesCurrentCustomer;

    public function settings(): JsonResponse
    {
        $config = SettingService::get('page_reviews', ['enabled' => true]);

        return $this->respond([
            'enabled' => (bool) data_get($config, 'enabled', false),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store_location_id' => [
                'required',
                'integer',
                Rule::exists('store_locations', 'id')->where('is_active', true),
            ],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $perPage = $validated['per_page'] ?? 15;

        $reviews = PageReview::query()
            ->where('store_location_id', $validated['store_location_id'])
            ->orderByDesc('created_at')
            ->with('photos')
            ->paginate($perPage);

        return $this->respond([
            'items' => $reviews->items(),
            'pagination' => [
                'page' => $reviews->currentPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $config = SettingService::get('page_reviews', ['enabled' => true]);

        if (!data_get($config, 'enabled', false)) {
            return $this->respond(null, 'Page reviews are disabled.', false, 403);
        }

        $customer = $this->currentCustomer();

        $validated = $request->validate([
            'store_location_id' => [
                'required',
                'integer',
                Rule::exists('store_locations', 'id')->where('is_active', true),
            ],
            'name' => [
                Rule::requiredIf(!$customer),
                'nullable',
                'string',
                'max:255',
            ],
            'email' => ['nullable', 'email', 'max:255'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['required_without:body', 'nullable', 'string', 'min:5'],
            'body' => ['required_without:content', 'nullable', 'string', 'min:5'],
            'photos' => ['nullable', 'array'],
            'photos.*' => ['file', 'image', 'max:5120'],
        ]);

        $name = $customer?->name ?? $validated['name'] ?? 'Guest';
        $email = $customer?->email ?? $validated['email'] ?? null;
        $body = $validated['content'] ?? $validated['body'];

        $review = PageReview::create([
            'store_location_id' => $validated['store_location_id'],
            'customer_id' => $customer?->id,
            'name' => $name,
            'email' => $email,
            'rating' => $validated['rating'],
            'title' => $validated['title'] ?? null,
            'body' => $body,
        ]);

        $photos = $request->file('photos');
        if ($photos instanceof UploadedFile) {
            $photos = [$photos];
        }

        if (is_array($photos)) {
            foreach ($photos as $photo) {
                $path = $photo->store('review-photos', 'public');

                ReviewPhoto::create([
                    'review_id' => $review->id,
                    'file_path' => $path,
                ]);
            }
        }

        $review->load('photos');

        return $this->respond($review, 'Review submitted successfully.');
    }
}
