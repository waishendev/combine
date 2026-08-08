<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class StoreLocationPosSetting extends Model
{
    protected $fillable = [
        'store_location_id', 'printer_enabled', 'printer_name', 'printer_connection_type',
        'printer_ip_address', 'printer_port', 'printer_paper_width',
        'printer_auto_print_receipt', 'printer_copies',
    ];

    protected $casts = [
        'printer_enabled' => 'boolean',
        'printer_port' => 'integer',
        'printer_paper_width' => 'integer',
        'printer_auto_print_receipt' => 'boolean',
        'printer_copies' => 'integer',
    ];

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }

    public function printerArray(): array
    {
        return [
            'is_enabled' => $this->printer_enabled,
            'printer_name' => $this->printer_name,
            'connection_type' => $this->printer_connection_type,
            'ip_address' => $this->printer_ip_address,
            'port' => $this->printer_port,
            'paper_width' => $this->printer_paper_width,
            'auto_print_receipt' => $this->printer_auto_print_receipt,
            'copies' => $this->printer_copies,
            'store_location_id' => (int) $this->store_location_id,
        ];
    }
}
