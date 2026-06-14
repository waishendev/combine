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
     * @param array<int, array{sku:string,name:string,cn_name?:string,variant_name?:string|null,variant_cn_name?:string|null,stock:int,threshold:int}> $products
     */
    public function sendDailyLowStockSummary(array $products): void
    {
        if (empty($products)) {
            return;
        }

        $lines = [];
        foreach ($products as $p) {
            $sku = trim((string) ($p['sku'] ?? ''));
            $name = trim((string) ($p['name'] ?? ''));
            $cnName = trim((string) ($p['cn_name'] ?? ''));
            $variantName = trim((string) ($p['variant_name'] ?? ''));
            $variantCnName = trim((string) ($p['variant_cn_name'] ?? ''));
            $stock = (int) ($p['stock'] ?? 0);
            $threshold = (int) ($p['threshold'] ?? 0);

            $line = sprintf(
                '%s - %s (Stock: %d, Threshold: %d)',
                $sku !== '' ? $sku : '-',
                $name !== '' ? $name : '-',
                $stock,
                $threshold
            );

            if ($cnName !== '') {
                $line .= "\n  {$cnName}";
            }

            if ($variantName !== '') {
                $line .= "\n  Variant: {$variantName}";
            }

            if ($variantCnName !== '') {
                $line .= "\n  {$variantCnName}";
            }

            $lines[] = $line;
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
