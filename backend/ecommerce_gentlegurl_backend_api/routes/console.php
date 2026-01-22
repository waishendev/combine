<?php

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
