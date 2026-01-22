<?php

namespace App\Providers;

use App\Listeners\LogMailSent;
use App\Listeners\LogMailSending;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 监听邮件发送事件
        Event::listen(MessageSending::class, LogMailSending::class);
        Event::listen(MessageSent::class, LogMailSent::class);
    }
}
