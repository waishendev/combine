<?php

use App\Jobs\SendDailyOrderSummaryEmailJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// =========================
// Ecommerce schedules
// =========================

Schedule::command('ecommerce:send-low-stock-summary')
    ->dailyAt('12:00')
    ->onOneServer()
    ->withoutOverlapping();

Schedule::command('ecommerce:expire-pending-orders')
    ->everyMinute()
    ->onOneServer()
    ->withoutOverlapping();

Schedule::command('ecommerce:expire-approved-returns')
    ->daily()
    ->onOneServer()
    ->withoutOverlapping();

Schedule::command('booking:expire-holds')
    ->everyMinute()
    ->onOneServer()
    ->withoutOverlapping();

Schedule::command('booking:expire-cart-items')
    ->everyMinute()
    ->onOneServer()
    ->withoutOverlapping();

Schedule::job(new SendDailyOrderSummaryEmailJob())
    ->dailyAt('10:00')
    ->onOneServer()
    ->withoutOverlapping();

// =========================
// Booking reminder emails
// =========================

Schedule::command('booking:send-reminder-emails')
    ->everyMinute()
    ->onOneServer()
    ->withoutOverlapping();
