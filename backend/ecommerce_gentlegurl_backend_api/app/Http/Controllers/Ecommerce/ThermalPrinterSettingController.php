<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Services\SettingService;
use App\Services\StoreLocationAccessService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationPosSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ThermalPrinterSettingController extends Controller
{
    private const SETTING_KEY = 'thermal_printer';

    public function __construct(private readonly StoreLocationAccessService $branchAccess) {}

    public function show(Request $request)
    {
        $branch = $this->branch($request, false);
        return $this->respond($this->settings($branch), null);
    }

    public function update(Request $request)
    {
        $branch = $this->branch($request, false);
        $settings = $this->validatedSettings($request);
        $this->persist($branch, $settings);

        return $this->respond($settings, 'Thermal printer settings updated successfully.');
    }

    public function updateAutoPrint(Request $request)
    {
        $validated = $request->validate([
            'auto_print_receipt' => ['required', 'boolean'],
        ]);
        $branch = $this->branch($request, true);
        $settings = $this->settings($branch);
        $settings['auto_print_receipt'] = (bool) $validated['auto_print_receipt'];
        $this->persist($branch, $settings);

        return $this->respond($settings, 'Auto Print Receipt preference updated.');
    }

    public function test(Request $request)
    {
        $branch = $this->branch($request, true);
        $settings = $this->validatedSettings($request);

        if ($settings['connection_type'] !== 'network') {
            return $this->respondError(
                ucfirst($settings['connection_type']).' printing is not supported by this application yet.',
                422
            );
        }

        $address = $settings['ip_address'];
        $port = $settings['port'];
        $errorNumber = 0;
        $errorMessage = '';
        $socket = @fsockopen($address, $port, $errorNumber, $errorMessage, 5);

        if (! is_resource($socket)) {
            $detail = $errorMessage !== '' ? $errorMessage : 'Connection timed out or was refused.';
            Log::warning('Thermal printer test failed', compact('address', 'port', 'errorNumber', 'detail'));

            return $this->respondError("Unable to reach printer at {$address}:{$port}. {$detail}", 422);
        }

        stream_set_timeout($socket, 5);
        $width = $settings['paper_width'] === 58 ? 32 : 48;
        $line = str_repeat('-', $width);
        $payload = "\x1B\x40\x1B\x61\x01"
            ."THERMAL PRINTER TEST\n{$line}\n"
            .($settings['printer_name'] ?: 'Default printer')."\n"
            .now()->format('Y-m-d H:i:s')."\n{$line}\n"
            ."Connection successful\n\n\n\x1D\x56\x00";
        $written = @fwrite($socket, $payload);
        fclose($socket);

        if ($written === false || $written < strlen($payload)) {
            return $this->respondError('Connected to the printer, but the test receipt could not be sent completely.', 422);
        }

        return $this->respond([
            'status' => 'sent',
            'address' => "{$address}:{$port}",
        ], 'Printer connected and test print sent.');
    }

    private function settings(StoreLocation $branch): array
    {
        $record = StoreLocationPosSetting::query()->where('store_location_id', $branch->id)->first();
        if ($record) {
            return $record->printerArray() + ['inherited_global_legacy' => false];
        }
        return array_merge($this->defaults(), (array) SettingService::get(self::SETTING_KEY, [], 'ecommerce'), [
            'store_location_id' => (int) $branch->id,
            'inherited_global_legacy' => true,
        ]);
    }

    private function defaults(): array
    {
        return [
            'is_enabled' => false,
            'printer_name' => null,
            'connection_type' => 'network',
            'ip_address' => null,
            'port' => 9100,
            'paper_width' => 80,
            'auto_print_receipt' => true,
            'copies' => 1,
        ];
    }

    private function validatedSettings(Request $request): array
    {
        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'printer_name' => ['nullable', 'string', 'max:255'],
            'connection_type' => ['required', Rule::in(['network', 'usb', 'bluetooth'])],
            'ip_address' => ['nullable', 'required_if:connection_type,network', 'string', 'max:253'],
            'port' => ['nullable', 'required_if:connection_type,network', 'integer', 'between:1,65535'],
            'paper_width' => ['required', 'integer', Rule::in([58, 80])],
            'auto_print_receipt' => ['required', 'boolean'],
            'copies' => ['required', 'integer', 'between:1,5'],
        ]);

        if ($validated['connection_type'] === 'network'
            && ! filter_var($validated['ip_address'], FILTER_VALIDATE_IP)
            && ! preg_match('/^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)*(?<!-)$/i', $validated['ip_address'])) {
            throw ValidationException::withMessages([
                'ip_address' => ['Enter a valid printer IP address or hostname.'],
            ]);
        }

        return [
            'is_enabled' => (bool) $validated['is_enabled'],
            'printer_name' => filled($validated['printer_name'] ?? null) ? trim($validated['printer_name']) : null,
            'connection_type' => $validated['connection_type'],
            'ip_address' => filled($validated['ip_address'] ?? null) ? trim($validated['ip_address']) : null,
            'port' => isset($validated['port']) ? (int) $validated['port'] : null,
            'paper_width' => (int) $validated['paper_width'],
            'auto_print_receipt' => (bool) $validated['auto_print_receipt'],
            'copies' => (int) $validated['copies'],
        ];
    }

    private function persist(StoreLocation $branch, array $settings): void
    {
        StoreLocationPosSetting::query()->updateOrCreate(['store_location_id' => $branch->id], [
            'printer_enabled' => $settings['is_enabled'],
            'printer_name' => $settings['printer_name'],
            'printer_connection_type' => $settings['connection_type'],
            'printer_ip_address' => $settings['ip_address'],
            'printer_port' => $settings['port'],
            'printer_paper_width' => $settings['paper_width'],
            'printer_auto_print_receipt' => $settings['auto_print_receipt'],
            'printer_copies' => $settings['copies'],
        ]);
    }

    private function branch(Request $request, bool $operational): StoreLocation
    {
        $id = (int) $request->input('store_location_id', $request->query('store_location_id', 0));
        if ($id <= 0) {
            throw ValidationException::withMessages(['store_location_id' => ['Select a specific Branch for printer settings.']]);
        }
        $branch = $this->branchAccess->authorizeStoreLocation($request->user(), $id, ! $operational);
        if ($operational && ! $branch->is_pos_available) {
            throw ValidationException::withMessages(['store_location_id' => ['The selected Branch is not available for POS printer operations.']]);
        }
        return $branch;
    }
}
