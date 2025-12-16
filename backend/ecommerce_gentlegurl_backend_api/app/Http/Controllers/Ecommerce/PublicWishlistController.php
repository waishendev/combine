<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicWishlistController extends Controller
{
    use ResolvesCurrentCustomer;

    public function index(Request $request)
    {
        $customer = $this->requireCustomer();

        $wishlist = DB::table('customer_wishlist_items as cwi')
            ->join('products', 'products.id', '=', 'cwi.product_id')
            ->leftJoin('product_images', function ($join) {
                $join->on('product_images.product_id', '=', 'products.id')
                    ->where('product_images.is_main', true);
            })
            ->where('cwi.customer_id', $customer->id)
            ->select([
                'products.id as product_id',
                'products.name as product_name',
                'products.slug as product_slug',
                'product_images.image_path as thumbnail',
                'cwi.created_at',
            ])
            ->orderByDesc('cwi.created_at')
            ->get();

        return $this->respond($wishlist);
    }

    public function toggle(Request $request)
    {
        $customer = $this->requireCustomer();

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $exists = DB::table('customer_wishlist_items')
            ->where('customer_id', $customer->id)
            ->where('product_id', $validated['product_id'])
            ->exists();

        $isFavorited = !$exists;

        if ($exists) {
            DB::table('customer_wishlist_items')
                ->where('customer_id', $customer->id)
                ->where('product_id', $validated['product_id'])
                ->delete();
        } else {
            DB::table('customer_wishlist_items')->insert([
                'customer_id' => $customer->id,
                'product_id' => $validated['product_id'],
                'created_at' => now(),
            ]);
        }

        return $this->respond([
            'customer_id' => $customer->id,
            'product_id' => $validated['product_id'],
            'is_favorited' => $isFavorited,
        ]);
    }
}
