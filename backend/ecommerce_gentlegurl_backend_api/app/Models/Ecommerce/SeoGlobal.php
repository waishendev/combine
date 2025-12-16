<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SeoGlobal extends Model
{
    use HasFactory;

    protected $table = 'seo_global';

    protected $fillable = [
        'default_title',
        'default_description',
        'default_keywords',
        'default_og_image',
    ];
}
