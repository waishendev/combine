<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class PublicAnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $query = Announcement::query()
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

    public function showByKey(string $key)
    {
        $announcement = Announcement::query()
            ->where('key', $key)
            ->active()
            ->current()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();

        return $this->respond($announcement);
    }
}
