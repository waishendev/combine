<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Customer;
use Illuminate\Console\Command;

class ResetAllCustomerPasswords extends Command
{
    protected $signature = 'customers:reset-passwords
                            {--password=gentlegurls : The new password for all customers}
                            {--force : Run without confirmation}';

    protected $description = 'Reset all customer passwords to the same value.';

    public function handle(): int
    {
        $password = (string) $this->option('password');
        if ($password === '') {
            $this->error('Password cannot be empty.');

            return Command::FAILURE;
        }

        $total = Customer::query()->count();
        if ($total === 0) {
            $this->info('No customers found.');

            return Command::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm("Reset password for all {$total} customers?", false)) {
            $this->warn('Cancelled.');

            return Command::SUCCESS;
        }

        $updated = 0;

        Customer::query()
            ->orderBy('id')
            ->chunkById(200, function ($customers) use ($password, &$updated) {
                foreach ($customers as $customer) {
                    $customer->password = $password;
                    $customer->save();
                    $updated++;
                }

                $this->output->write('.');
            });

        $this->newLine();
        $this->info("Updated {$updated} customer password(s).");

        return Command::SUCCESS;
    }
}
