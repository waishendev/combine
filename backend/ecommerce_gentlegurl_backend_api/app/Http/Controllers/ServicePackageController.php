<?php

namespace App\Http\Controllers;

use App\Models\Booking\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ServicePackageController extends Controller
{
    public function index(Request $request)
    {
        $query = ServicePackage::query()->with(['items.bookingService:id,name']);

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $this->respond($query->orderByDesc('id')->paginate(min(100, max(1, (int) $request->query('per_page', 20)))));
    }

    public function show(int $id)
    {
        return $this->respond(ServicePackage::with(['items.bookingService:id,name'])->findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $pkg = DB::transaction(function () use ($data) {
            $pkg = ServicePackage::create(collect($data)->except('items')->all());
            $pkg->items()->createMany($data['items']);
            return $pkg->load(['items.bookingService:id,name']);
        });

        return $this->respond($pkg, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $pkg = ServicePackage::findOrFail($id);
        $data = $this->validatePayload($request);

        $pkg = DB::transaction(function () use ($pkg, $data) {
            $pkg->update(collect($data)->except('items')->all());
            $pkg->items()->delete();
            $pkg->items()->createMany($data['items']);
            return $pkg->load(['items.bookingService:id,name']);
        });

        return $this->respond($pkg);
    }

    public function destroy(int $id)
    {
        ServicePackage::findOrFail($id)->delete();
        return $this->respond(null);
    }

    public function exportCsv(Request $request)
    {
        $packages = ServicePackage::query()
            ->with('items')
            ->orderBy('id')
            ->get();

        $stream = fopen('php://temp', 'r+');
        if (! $stream) {
            return response()->json(['message' => 'Unable to build booking service packages CSV export.'], 500);
        }

        $headers = ['id', 'name', 'description', 'selling_price', 'valid_days', 'is_active', 'items_json'];
        fputcsv($stream, $headers);

        foreach ($packages as $package) {
            $items = $package->items
                ->map(fn ($item) => [
                    'booking_service_id' => (int) $item->booking_service_id,
                    'quantity' => (int) $item->quantity,
                ])
                ->values()
                ->all();

            fputcsv($stream, [
                $package->id,
                $package->name,
                $package->description,
                $package->selling_price,
                $package->valid_days,
                $package->is_active ? 'true' : 'false',
                json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }

        rewind($stream);
        $csv = stream_get_contents($stream) ?: '';
        fclose($stream);

        return response("\xEF\xBB\xBF" . $csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="booking-service-packages-export_' . now()->format('Y-m-d_His') . '.csv"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    public function importCsv(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        if (! $handle) {
            return response()->json(['message' => 'Unable to open CSV file.'], 422);
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            return response()->json(['message' => 'Invalid CSV header row.'], 422);
        }

        $headers = array_map(fn ($header) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header)), $headers);
        $allowedHeaders = ['id', 'name', 'description', 'selling_price', 'valid_days', 'is_active', 'items_json'];
        $unknownHeaders = array_values(array_diff(array_filter($headers), $allowedHeaders));
        if (! empty($unknownHeaders)) {
            fclose($handle);
            return response()->json(['message' => 'Unexpected CSV headers: ' . implode(', ', $unknownHeaders)], 422);
        }

        $summary = ['totalRows' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0, 'failed' => 0, 'failedRows' => []];
        $rowNumber = 1;

        while (($cells = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (! is_array($cells)) {
                continue;
            }

            $payload = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $payload[$header] = isset($cells[$index]) ? trim((string) $cells[$index]) : '';
            }

            $isAllEmpty = count(array_filter($payload, fn ($value) => $value !== '')) === 0;
            if ($isAllEmpty) {
                continue;
            }

            $summary['totalRows']++;

            $itemsRaw = $payload['items_json'] ?? '[]';
            $items = json_decode($itemsRaw, true);
            if (! is_array($items)) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => 'items_json must be a valid JSON array.'];
                continue;
            }

            $raw = [
                'name' => $payload['name'] ?? null,
                'description' => $payload['description'] ?? null,
                'selling_price' => $payload['selling_price'] ?? null,
                'valid_days' => $payload['valid_days'] !== '' ? $payload['valid_days'] : null,
                'is_active' => $payload['is_active'] ?? 'true',
                'items' => $items,
            ];
            $raw['is_active'] = filter_var((string) $raw['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

            $validator = Validator::make($raw, [
                'name' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'selling_price' => ['required', 'numeric', 'min:0'],
                'valid_days' => ['nullable', 'integer', 'min:1'],
                'is_active' => ['required', 'boolean'],
                'items' => ['required', 'array', 'min:1'],
                'items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
                'items.*.quantity' => ['required', 'integer', 'min:1'],
            ]);

            if ($validator->fails()) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $validator->errors()->first()];
                continue;
            }

            $validated = $validator->validated();
            $id = isset($payload['id']) && is_numeric($payload['id']) ? (int) $payload['id'] : null;

            try {
                DB::transaction(function () use ($id, $validated, &$summary) {
                    $package = $id ? ServicePackage::query()->find($id) : null;
                    if (! $package) {
                        $package = ServicePackage::query()->create(collect($validated)->except('items')->all());
                        $summary['created']++;
                    } else {
                        $currentItems = $package->items()
                            ->get(['booking_service_id', 'quantity'])
                            ->map(fn ($item) => [
                                'booking_service_id' => (int) $item->booking_service_id,
                                'quantity' => (int) $item->quantity,
                            ])
                            ->sortBy(fn ($item) => sprintf('%010d-%010d', $item['booking_service_id'], $item['quantity']))
                            ->values()
                            ->all();
                        $incomingItems = collect($validated['items'])
                            ->map(fn ($item) => [
                                'booking_service_id' => (int) $item['booking_service_id'],
                                'quantity' => (int) $item['quantity'],
                            ])
                            ->sortBy(fn ($item) => sprintf('%010d-%010d', $item['booking_service_id'], $item['quantity']))
                            ->values()
                            ->all();
                        $isUnchanged =
                            ($package->name === $validated['name']) &&
                            (($package->description ?? null) === ($validated['description'] ?? null)) &&
                            ((float) $package->selling_price === (float) $validated['selling_price']) &&
                            ((int) ($package->valid_days ?? 0) === (int) ($validated['valid_days'] ?? 0)) &&
                            ((bool) $package->is_active === (bool) $validated['is_active']) &&
                            ($currentItems === $incomingItems);
                        if ($isUnchanged) {
                            $summary['skipped']++;
                            return;
                        }
                        $package->update(collect($validated)->except('items')->all());
                        $package->items()->delete();
                        $summary['updated']++;
                    }

                    $package->items()->createMany($validated['items']);
                });
            } catch (\Throwable $throwable) {
                $summary['failed']++;
                $summary['failedRows'][] = ['row' => $rowNumber, 'reason' => $throwable->getMessage()];
            }
        }

        fclose($handle);

        return $this->respond($summary, 'CSV import processed.');
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'valid_days' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);
    }
}
