<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Ecommerce\Customer;

trait ResolvesCurrentCustomer
{
    protected function currentCustomer(): ?Customer
    {
        if (auth('customer')->check()) {
            /** @var Customer|null $customer */
            $customer = auth('customer')->user();
            
            // If user() returns null even though check() returned true,
            // it means the customer record might have been deleted
            if ($customer instanceof Customer) {
                return $customer;
            }
            
            // Customer session exists but user is null - clear the session
            // This can happen if the customer record was deleted
            auth('customer')->logout();
            return null;
        }

        if (auth('sanctum')->check()) {
            $user = auth('sanctum')->user();
            if ($user instanceof Customer) {
                return $user;
            }
        }

        return null;
    }

    protected function requireCustomer(): Customer
    {
        $customer = $this->currentCustomer();

        if (!$customer) {
            abort(401, 'Customer not authenticated');
        }

        return $customer;
    }
}
