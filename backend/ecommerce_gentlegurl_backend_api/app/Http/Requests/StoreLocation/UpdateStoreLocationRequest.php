<?php

namespace App\Http\Requests\StoreLocation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $location = $this->route('storeLocation');

        return [
            'id' => ['prohibited'],
            'code' => ['sometimes', Rule::in([(string) $location->code])],
            'name' => ['sometimes', 'string', 'max:150'],
            'address_line1' => ['sometimes', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:100'],
            'state' => ['sometimes', 'string', 'max:100'],
            'postcode' => ['sometimes', 'string', 'max:20'],
            'country' => ['sometimes', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
            'is_pickup_available' => ['sometimes', 'boolean'],
            'is_booking_available' => ['sometimes', 'boolean'],
            'is_pos_available' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'opening_hours' => ['nullable', 'array'],
            'opening_hours.*' => ['string', 'max:255'],
            'images' => ['nullable', 'array', 'max:6'],
            'images.*' => ['image', 'mimes:jpeg,jpg,png,gif,webp', 'max:5120'],
            'delete_image_ids' => ['nullable', 'array'],
            'delete_image_ids.*' => ['integer', 'exists:store_location_images,id'],
            'image_order' => ['nullable', 'array'],
            'image_order.*' => ['string', 'max:50'],
        ];
    }
}
