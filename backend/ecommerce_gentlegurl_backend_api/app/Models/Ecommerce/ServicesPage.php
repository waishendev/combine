<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class ServicesPage extends Model
{
    use HasFactory;

    protected $fillable = [
        'services_menu_item_id',
        'title',
        'slug',
        'subtitle',
        'hero_slides',
        'sections',
        'is_active',
    ];

    protected $casts = [
        'hero_slides' => 'array',
        'sections' => 'array',
        'is_active' => 'boolean',
    ];

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(ServicesMenuItem::class, 'services_menu_item_id');
    }

    public function slides(): HasMany
    {
        return $this->hasMany(ServicesPageSlide::class, 'services_page_id')->orderBy('sort_order');
    }

    public function getHeroSlidesAttribute($value): array
    {
        /** @var Collection<int, ServicesPageSlide> $slides */
        $slides = $this->relationLoaded('slides')
            ? $this->slides
            : $this->slides()->get();

        if ($slides->isNotEmpty()) {
            return $slides->map(function (ServicesPageSlide $slide) {
                return [
                    'id' => $slide->id,
                    'sort_order' => $slide->sort_order,
                    'src' => $slide->desktop_src,
                    'mobileSrc' => $slide->mobile_src,
                    'alt' => $slide->alt,
                    'title' => $slide->title,
                    'description' => $slide->description,
                    'buttonLabel' => $slide->button_label,
                    'buttonHref' => $slide->button_href,
                ];
            })->values()->all();
        }

        $decoded = is_array($value) ? $value : json_decode($value ?? '[]', true);
        if (! is_array($decoded)) {
            return [];
        }

        $normalized = [];
        foreach (array_values($decoded) as $index => $slide) {
            if (! is_array($slide)) {
                continue;
            }
            $normalized[] = [
                'sort_order' => $slide['sort_order'] ?? $index + 1,
                'src' => $slide['src'] ?? '',
                'mobileSrc' => $slide['mobileSrc'] ?? '',
                'alt' => $slide['alt'] ?? '',
                'title' => $slide['title'] ?? '',
                'description' => $slide['description'] ?? ($slide['subtitle'] ?? ''),
                'buttonLabel' => $slide['buttonLabel'] ?? '',
                'buttonHref' => $slide['buttonHref'] ?? '',
            ];
        }

        return $normalized;
    }
}
