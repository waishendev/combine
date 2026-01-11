<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\CustomerAddress;
use Illuminate\Database\DatabaseManager;
use Illuminate\Http\Request;

class PublicCustomerAddressController extends Controller
{
    use ResolvesCurrentCustomer;

    public function __construct(protected DatabaseManager $db)
    {
    }

    public function index(Request $request)
    {
        $customer = $this->requireCustomer();

        $addresses = $customer->addresses()
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return $this->respond($addresses);
    }

    public function store(Request $request)
    {
        $customer = $this->requireCustomer();

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:billing,shipping'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'line1' => ['required', 'string', 'max:255'],
            'line2' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['required', 'string', 'max:255'],
            'postcode' => ['required', 'string', 'max:20'],
            'country' => ['required', 'string', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if (empty($data['is_default'])) {
            $hasDefault = $customer->addresses()->where('is_default', true)->exists();
            if (!$hasDefault) {
                $data['is_default'] = true;
            }
        }

        /** @var CustomerAddress $address */
        $address = null;

        $this->db->transaction(function () use ($customer, $data, &$address) {
            if (!empty($data['is_default'])) {
                CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);
            }

            $address = $customer->addresses()->create($data);
        });

        return $this->respond($address, 'Address created successfully.');
    }

    public function update(Request $request, int $id)
    {
        $customer = $this->requireCustomer();

        $address = CustomerAddress::where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:billing,shipping'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'line1' => ['required', 'string', 'max:255'],
            'line2' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['required', 'string', 'max:255'],
            'postcode' => ['required', 'string', 'max:20'],
            'country' => ['required', 'string', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $this->db->transaction(function () use (&$address, $data, $customer) {
            if (!empty($data['is_default'])) {
                CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);
            }

            $address->fill($data);
            $address->save();
        });

        return $this->respond($address->fresh(), 'Address updated successfully.');
    }

    public function destroy(Request $request, int $id)
    {
        $customer = $this->requireCustomer();

        $address = CustomerAddress::where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $wasDefault = $address->is_default;

        $this->db->transaction(function () use ($customer, $address, $wasDefault) {
            $address->delete();

            if ($wasDefault) {
                $nextDefault = CustomerAddress::where('customer_id', $customer->id)
                    ->orderBy('id')
                    ->first();

                if ($nextDefault) {
                    CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);
                    $nextDefault->is_default = true;
                    $nextDefault->save();
                }
            }
        });

        return $this->respond(null, 'Address deleted successfully.');
    }

    public function makeDefault(Request $request, int $id)
    {
        $customer = $this->requireCustomer();

        $address = CustomerAddress::where('id', $id)
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $this->db->transaction(function () use ($customer, $address) {
            CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);

            $address->is_default = true;
            $address->save();
        });

        return $this->respond($address->fresh(), 'Default address updated.');
    }
}

