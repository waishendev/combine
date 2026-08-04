<?php

namespace App\Services\Notifications;

use App\Mail\DailyLowStockSummaryMail;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    public function __construct(
        private TemplateRenderer $renderer,
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

        // Out-of-stock first, then lowest remaining stock.
        usort($products, function (array $a, array $b): int {
            $stockCmp = (int) ($a['stock'] ?? 0) <=> (int) ($b['stock'] ?? 0);
            if ($stockCmp !== 0) {
                return $stockCmp;
            }

            return strcmp((string) ($a['sku'] ?? ''), (string) ($b['sku'] ?? ''));
        });

        $date = now()->toDateString();

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
            'date' => $date,
            'product_list' => implode("\n", $lines),
        ];

        $adminEmails = array_values(array_unique(array_filter(
            array_map('trim', explode(',', (string) env('NOTIFY_ADMIN_EMAILS', ''))),
            fn ($email) => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)
        )));

        if (! empty($adminEmails)) {
            $tpl = $this->renderer->getTemplate('stock.low.admin.email', 'email');
            $subject = 'Daily Low Stock Summary - '.$date;
            if ($tpl) {
                $rendered = $this->renderer->renderSubject($tpl->subject_template, $data);
                if (is_string($rendered) && trim($rendered) !== '') {
                    $subject = $rendered;
                }
            }

            foreach ($adminEmails as $email) {
                Mail::to($email)->send(new DailyLowStockSummaryMail($products, $date, $subject));
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
