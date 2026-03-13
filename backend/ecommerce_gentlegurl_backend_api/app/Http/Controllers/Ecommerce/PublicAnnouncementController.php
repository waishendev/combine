<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class PublicAnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $type = $this->resolveType($request);

        $query = Announcement::query()
            ->ofType($type)
            ->active()
            ->current()
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($request->filled('key')) {
            $query->where('key', $request->get('key'));
        }

        $announcements = $query->get();

        return $this->respond($announcements);
    }

    public function showByKey(Request $request, string $key)
    {
        $type = $this->resolveType($request);

        $announcement = Announcement::query()
            ->ofType($type)
            ->where('key', $key)
            ->active()
            ->current()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();

        return $this->respond($announcement);
    }

    private function resolveType(Request $request): string
    {
        $type = $request->get('type');

        return in_array($type, [Announcement::TYPE_ECOMMERCE, Announcement::TYPE_BOOKING], true)
            ? $type
            : Announcement::TYPE_ECOMMERCE;
    }
}
