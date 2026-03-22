<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\CustomerBookingContact;
use Illuminate\Database\DatabaseManager;
use Illuminate\Http\Request;

class CustomerBookingContactController extends Controller
{
    public function __construct(protected DatabaseManager $db)
    {
    }

    public function index(Request $request)
    {
        $customer = $request->user('customer');

        if (! $customer) {
            return $this->respondError('Unauthorized.', 401);
        }

        $contacts = CustomerBookingContact::query()
            ->where('customer_id', $customer->id)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return $this->respond($contacts);
    }

    public function store(Request $request)
    {
        $customer = $request->user('customer');

        if (! $customer) {
            return $this->respondError('Unauthorized.', 401);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50', 'regex:/^\+?[0-9]{8,15}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if (empty($data['is_default'])) {
            $hasDefault = CustomerBookingContact::query()
                ->where('customer_id', $customer->id)
                ->where('is_default', true)
                ->exists();

            if (! $hasDefault) {
                $data['is_default'] = true;
            }
        }

        $contact = null;

        $this->db->transaction(function () use (&$contact, $customer, $data) {
            if (! empty($data['is_default'])) {
                CustomerBookingContact::query()
                    ->where('customer_id', $customer->id)
                    ->update(['is_default' => false]);
            }

            $contact = CustomerBookingContact::query()->create([
                'customer_id' => $customer->id,
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);
        });

        return $this->respond($contact, 'Contact created successfully.');
    }

    public function update(Request $request, int $id)
    {
        $customer = $request->user('customer');

        if (! $customer) {
            return $this->respondError('Unauthorized.', 401);
        }

        $contact = CustomerBookingContact::query()
            ->where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50', 'regex:/^\+?[0-9]{8,15}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $this->db->transaction(function () use ($customer, $contact, $data) {
            if (! empty($data['is_default'])) {
                CustomerBookingContact::query()
                    ->where('customer_id', $customer->id)
                    ->update(['is_default' => false]);
            }

            $contact->fill([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);
            $contact->save();
        });

        return $this->respond($contact->fresh(), 'Contact updated successfully.');
    }

    public function destroy(Request $request, int $id)
    {
        $customer = $request->user('customer');

        if (! $customer) {
            return $this->respondError('Unauthorized.', 401);
        }

        $contact = CustomerBookingContact::query()
            ->where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $wasDefault = (bool) $contact->is_default;

        $this->db->transaction(function () use ($customer, $contact, $wasDefault) {
            $contact->delete();

            if (! $wasDefault) {
                return;
            }

            $nextDefault = CustomerBookingContact::query()
                ->where('customer_id', $customer->id)
                ->orderBy('id')
                ->first();

            if ($nextDefault) {
                CustomerBookingContact::query()
                    ->where('customer_id', $customer->id)
                    ->update(['is_default' => false]);

                $nextDefault->is_default = true;
                $nextDefault->save();
            }
        });

        return $this->respond(null, 'Contact deleted successfully.');
    }

    public function makeDefault(Request $request, int $id)
    {
        $customer = $request->user('customer');

        if (! $customer) {
            return $this->respondError('Unauthorized.', 401);
        }

        $contact = CustomerBookingContact::query()
            ->where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $this->db->transaction(function () use ($customer, $contact) {
            CustomerBookingContact::query()
                ->where('customer_id', $customer->id)
                ->update(['is_default' => false]);

            $contact->is_default = true;
            $contact->save();
        });

        return $this->respond($contact->fresh(), 'Default contact updated.');
    }
}
