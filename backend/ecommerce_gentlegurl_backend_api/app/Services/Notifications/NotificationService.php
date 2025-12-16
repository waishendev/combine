<?php

namespace App\Services\Notifications;

class NotificationService
{
    public function __construct(
        private TemplateRenderer $renderer,
        private EmailSender $emailSender,
        private WhatsAppSender $whatsAppSender,
    ) {
    }

    /**
     * @param array<int, array{sku:string,name:string,stock:int,threshold:int}> $products
     */
    public function sendDailyLowStockSummary(array $products): void
    {
        if (empty($products)) {
            return;
        }

        $lines = [];
        foreach ($products as $p) {
            $lines[] = sprintf(
                '%s - %s (Stock: %d, Threshold: %d)',
                $p['sku'] ?? '',
                $p['name'] ?? '',
                $p['stock'] ?? 0,
                $p['threshold'] ?? 0
            );
        }

        $data = [
            'date' => now()->toDateString(),
            'product_list' => implode("\n", $lines),
        ];

        $adminEmails = array_filter(array_map('trim', explode(',', env('NOTIFY_ADMIN_EMAILS', ''))));

        if (! empty($adminEmails)) {
            $tpl = $this->renderer->getTemplate('stock.low.admin.email', 'email');
            if ($tpl) {
                $subject = $this->renderer->renderSubject($tpl->subject_template, $data) ?: 'Daily Low Stock Alert';
                $body = $this->renderer->render($tpl->body_template, $data);

                foreach ($adminEmails as $email) {
                    $this->emailSender->send($email, $subject, $body);
                }
            }
        }

        $adminWhatsApp = env('NOTIFY_ADMIN_WHATSAPP');
        if ($adminWhatsApp) {
            $tpl = $this->renderer->getTemplate('stock.low.admin.whatsapp', 'whatsapp');
            if ($tpl) {
                $body = $this->renderer->render($tpl->body_template, $data);
                $this->whatsAppSender->send($adminWhatsApp, $body);
            }
        }
    }
}
