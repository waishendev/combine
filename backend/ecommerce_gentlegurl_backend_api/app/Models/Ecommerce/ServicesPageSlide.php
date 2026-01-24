<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServicesPageSlide extends Model
{
    use HasFactory;

    protected $fillable = [
        'services_page_id',
        'sort_order',
        'image_path',
        'mobile_image_path',
        'title',
        'description',
        'button_label',
        'button_link',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(ServicesPage::class, 'services_page_id');
    }
}
