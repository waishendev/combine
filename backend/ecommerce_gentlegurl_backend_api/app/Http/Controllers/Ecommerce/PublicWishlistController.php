<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PublicWishlistController extends Controller
{
    use ResolvesCurrentCustomer;

    public function index(Request $request)
    {
        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($request->query('session_token') ?: $request->cookie('shop_session_token'));

        if (!$customer && !$sessionToken) {
            return $this->respond([]);
        }

        $wishlist = $this->buildWishlistQuery($customer?->id, $sessionToken)
            ->get()
            ->map(function ($item) {
                // Convert thumbnail path to full URL
                $thumbnail = $item->thumbnail;
                if ($thumbnail) {
                    // If it's already a full URL, return it as is
                    if (filter_var($thumbnail, FILTER_VALIDATE_URL)) {
                        $item->thumbnail = $thumbnail;
                    } else {
                        // Normalize path: remove leading slash to avoid double slashes
                        $normalizedPath = ltrim($thumbnail, '/');
                        // If it's a storage path, return the full URL
                        if (Storage::disk('public')->exists($normalizedPath)) {
                            $item->thumbnail = Storage::disk('public')->url($normalizedPath);
                        } else {
                            // Fallback: construct URL manually
                            $item->thumbnail = url('storage/' . ltrim($thumbnail, '/'));
                        }
                    }
                }
                $item->cover_image_url = $item->thumbnail;

                return $item;
            });

        return $this->respond([
            'items' => $wishlist,
            'customer_id' => $customer?->id,
            'session_token' => $sessionToken,
        ]);
    }

    public function toggle(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'session_token' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = $this->currentCustomer();
        $sessionToken = $customer ? null : ($validated['session_token'] ?? $request->query('session_token') ?? $request->cookie('shop_session_token'));

        if (!$customer && !$sessionToken) {
            $sessionToken = (string) Str::uuid();
        }

        $query = $customer
            ? DB::table('customer_wishlist_items')->where('customer_id', $customer->id)
            : DB::table('guest_wishlist_items')->where('session_token', $sessionToken);

        $exists = $query->where('product_id', $validated['product_id'])->exists();

        $isFavorited = !$exists;

        if ($exists) {
            $query->where('product_id', $validated['product_id'])->delete();
        } else {
            $insertData = [
                'product_id' => $validated['product_id'],
                'created_at' => now(),
            ];

            if ($customer) {
                $insertData['customer_id'] = $customer->id;
                DB::table('customer_wishlist_items')->insert($insertData);
            } else {
                $insertData['session_token'] = $sessionToken;
                DB::table('guest_wishlist_items')->insert($insertData);
            }
        }

        return $this->respond([
            'customer_id' => $customer?->id,
            'product_id' => $validated['product_id'],
            'is_favorited' => $isFavorited,
            'session_token' => $sessionToken,
        ]);
    }

    public function merge(Request $request)
    {
        $sessionToken = $request->input('session_token') ?? $request->query('session_token');

        if (!$sessionToken) {
            return $this->respondError('session_token is required.');
        }

        $customer = $this->currentCustomer();

        if (!$customer) {
            return $this->respondError('Login required to merge wishlist.', 401);
        }

        $guestProductIds = DB::table('guest_wishlist_items')
            ->where('session_token', $sessionToken)
            ->pluck('product_id');

        if ($guestProductIds->isEmpty()) {
            return $this->respond([
                'message' => 'No guest wishlist items to merge.',
                'customer_id' => $customer->id,
            ]);
        }

        $existingProductIds = DB::table('customer_wishlist_items')
            ->where('customer_id', $customer->id)
            ->pluck('product_id');

        $newItems = $guestProductIds->diff($existingProductIds);

        foreach ($newItems as $productId) {
            DB::table('customer_wishlist_items')->updateOrInsert(
                ['customer_id' => $customer->id, 'product_id' => $productId],
                ['created_at' => now()],
            );
        }

        DB::table('guest_wishlist_items')
            ->where('session_token', $sessionToken)
            ->delete();

        return $this->respond([
            'message' => 'Wishlist merged successfully.',
            'customer_id' => $customer->id,
            'merged_count' => $newItems->count(),
        ]);
    }

    protected function buildWishlistQuery(?int $customerId, ?string $sessionToken)
    {
        $table = $customerId ? 'customer_wishlist_items as w' : 'guest_wishlist_items as w';

        $query = DB::table($table)
            ->join('products', 'products.id', '=', 'w.product_id')
            ->leftJoin('product_media', function ($join) {
                $join->on('product_media.product_id', '=', 'products.id')
                    ->where('product_media.type', 'image')
                    ->where('product_media.sort_order', 0);
            })
            ->select([
                'products.id as product_id',
                'products.name as product_name',
                'products.slug as product_slug',
                'product_media.path as thumbnail',
                'w.created_at',
            ])
            ->orderByDesc('w.created_at');

        if ($customerId) {
            $query->where('w.customer_id', $customerId);
        } else {
            $query->where('w.session_token', $sessionToken);
        }

        return $query;
    }
}
