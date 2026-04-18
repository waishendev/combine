<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\CustomerType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerTypeController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $search = $request->string('search')->toString();

        $types = CustomerType::query()
            ->when($search !== '', fn ($query) => $query->where('name', 'like', "%{$search}%"))
            ->orderBy('name')
            ->paginate($perPage);

        return $this->respond($types);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:customer_types,name'],
        ]);

        $type = CustomerType::create([
            'name' => trim((string) $validated['name']),
        ]);

        return $this->respond($type, __('Customer type created successfully.'));
    }

    public function show(CustomerType $customerType)
    {
        return $this->respond($customerType);
    }

    public function update(Request $request, CustomerType $customerType)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('customer_types', 'name')->ignore($customerType->id)],
        ]);

        $customerType->fill([
            'name' => trim((string) $validated['name']),
        ]);
        $customerType->save();

        return $this->respond($customerType, __('Customer type updated successfully.'));
    }

    public function destroy(CustomerType $customerType)
    {
        $customerType->delete();

        return $this->respond(null, __('Customer type deleted successfully.'));
    }
}
