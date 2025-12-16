<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\SeoGlobal;
use Illuminate\Http\Request;

class SeoGlobalController extends Controller
{
    public function show()
    {
        $seo = SeoGlobal::first();

        return $this->respond($seo ?? [
            'default_title' => null,
            'default_description' => null,
            'default_keywords' => null,
            'default_og_image' => null,
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'default_title' => ['nullable', 'string', 'max:255'],
            'default_description' => ['nullable', 'string'],
            'default_keywords' => ['nullable', 'string'],
            'default_og_image' => ['nullable', 'string', 'max:255'],
        ]);

        $seo = SeoGlobal::query()->first();

        if ($seo) {
            $seo->update($validated);
        } else {
            $seo = SeoGlobal::create($validated);
        }

        return $this->respond($seo, __('SEO settings updated successfully.'));
    }
}
