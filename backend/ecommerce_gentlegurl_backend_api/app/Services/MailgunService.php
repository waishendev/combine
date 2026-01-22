<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Mailgun\Mailgun;

class MailgunService
{
    private ?Mailgun $mg = null;

    public function __construct()
    {
        $apiKey = config('services.mailgun.secret');
        $domain = config('services.mailgun.domain');
        
        if (!$apiKey || !$domain) {
            Log::error('MailgunService: Missing API key or domain', [
                'has_api_key' => !empty($apiKey),
                'has_domain' => !empty($domain),
            ]);
            return;
        }

        try {
            // 检查是否是 EU domain，如果是需要使用 EU endpoint
            $endpoint = $this->isEuDomain($domain) 
                ? 'https://api.eu.mailgun.net' 
                : 'https://api.mailgun.net';
            
            $this->mg = Mailgun::create($apiKey, $endpoint);
            
            Log::info('MailgunService initialized', [
                'domain' => $domain,
                'endpoint' => $endpoint,
                'api_key_length' => strlen($apiKey),
            ]);
        } catch (\Exception $e) {
            Log::error('MailgunService: Failed to initialize', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send email using Mailgun PHP SDK
     */
    public function sendEmail(string $to, string $subject, string $html, ?string $text = null): ?array
    {
        if (!$this->mg) {
            Log::error('MailgunService: Not initialized');
            return null;
        }

        $domain = config('services.mailgun.domain');
        $fromAddress = config('mail.from.address', 'no-reply@' . $domain);
        $fromName = config('mail.from.name', 'Gentlegurls');

        $params = [
            'from' => sprintf('%s <%s>', $fromName, $fromAddress),
            'to' => $to,
            'subject' => $subject,
            'html' => $html,
        ];

        if ($text) {
            $params['text'] = $text;
        }

        try {
            Log::info('MailgunService: Sending email via Mailgun SDK', [
                'to' => $to,
                'from' => $params['from'],
                'subject' => $subject,
                'domain' => $domain,
            ]);

            $result = $this->mg->messages()->send($domain, $params);
            
            // 获取响应消息
            $responseMessage = $result->getMessage();
            $responseId = $result->getId();
            
            Log::info('✅ MailgunService: Email sent successfully via Mailgun SDK', [
                'to' => $to,
                'subject' => $subject,
                'mailgun_message_id' => $responseId,
                'mailgun_response' => $responseMessage,
                'full_response' => [
                    'id' => $responseId,
                    'message' => $responseMessage,
                ],
            ]);

            return [
                'success' => true,
                'id' => $responseId,
                'message' => $responseMessage,
            ];
        } catch (\Exception $e) {
            Log::error('MailgunService: Failed to send email', [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check if domain is EU domain
     */
    private function isEuDomain(string $domain): bool
    {
        // You can add logic here to check if domain is EU
        // For now, return false (US domain)
        return false;
    }
}
