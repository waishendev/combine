<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Log;

class LogMailSent
{
    /**
     * Handle the event.
     */
    public function handle(MessageSent $event): void
    {
        $message = $event->message;
        
        // 获取邮件信息
        $to = $this->getAddresses($message->getTo());
        $from = $this->getAddresses($message->getFrom());
        $subject = $message->getSubject();
        
        // 尝试获取 Mailgun 响应
        $mailgunResponse = null;
        $mailgunMessageId = null;
        
        // 方法1: 从事件的 data 属性获取
        if (property_exists($event, 'data') && is_array($event->data)) {
            $mailgunResponse = $event->data;
        }
        
        // 方法2: 尝试从传输响应中获取
        try {
            // 使用反射获取 sent 属性（如果存在）
            $reflection = new \ReflectionClass($event);
            if ($reflection->hasProperty('sent')) {
                $sentProperty = $reflection->getProperty('sent');
                $sentProperty->setAccessible(true);
                $sent = $sentProperty->getValue($event);
                
                if ($sent) {
                    $mailgunResponse = [
                        'sent_type' => gettype($sent),
                        'sent_class' => is_object($sent) ? get_class($sent) : null,
                    ];
                    
                    // 尝试获取 SentMessage 的所有属性
                    if (is_object($sent)) {
                        try {
                            $sentReflection = new \ReflectionClass($sent);
                            $properties = $sentReflection->getProperties();
                            
                            foreach ($properties as $property) {
                                $property->setAccessible(true);
                                $value = $property->getValue($sent);
                                $propertyName = $property->getName();
                                
                                // 尝试获取消息 ID
                                if ($propertyName === 'messageId' || $propertyName === 'id') {
                                    $mailgunMessageId = $value;
                                }
                                
                                // 如果是响应对象，尝试获取内容
                                if (is_object($value)) {
                                    if (method_exists($value, 'getContent')) {
                                        try {
                                            $content = $value->getContent();
                                            $mailgunResponse[$propertyName . '_content'] = $content;
                                            
                                            // 尝试解析 JSON
                                            if (is_string($content)) {
                                                $json = json_decode($content, true);
                                                if ($json) {
                                                    $mailgunResponse[$propertyName . '_json'] = $json;
                                                    if (isset($json['id'])) {
                                                        $mailgunMessageId = $json['id'];
                                                    }
                                                    if (isset($json['message'])) {
                                                        $mailgunResponse['mailgun_message'] = $json['message'];
                                                    }
                                                }
                                            }
                                        } catch (\Exception $e) {
                                            // 忽略
                                        }
                                    }
                                    
                                    // 尝试获取所有方法
                                    if (method_exists($value, 'toArray')) {
                                        $mailgunResponse[$propertyName . '_array'] = $value->toArray();
                                    }
                                } else {
                                    $mailgunResponse[$propertyName] = $value;
                                }
                            }
                        } catch (\Exception $e) {
                            $mailgunResponse['reflection_error'] = $e->getMessage();
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            $mailgunResponse['error'] = $e->getMessage();
        }
        
        // 方法3: 从消息 headers 中获取 Mailgun 消息 ID
        try {
            $headers = $message->getHeaders();
            if ($headers) {
                $xMailgunMessageId = $headers->get('X-Mailgun-Message-Id');
                if ($xMailgunMessageId && method_exists($xMailgunMessageId, 'getBodyAsString')) {
                    $mailgunMessageId = $xMailgunMessageId->getBodyAsString();
                }
            }
        } catch (\Exception $e) {
            // 忽略错误
        }
        
        Log::info('✅ Mail sent to Mailgun - RESPONSE RECEIVED', [
            'to' => $to,
            'from' => $from,
            'subject' => $subject,
            'mailgun_message_id' => $mailgunMessageId,
            'mailgun_response' => $mailgunResponse,
            'mail_driver' => config('mail.default'),
            'mailgun_domain' => config('services.mailgun.domain'),
            'timestamp' => now()->toIso8601String(),
        ]);
    }
    
    private function getAddresses($addresses): array
    {
        if (!$addresses) {
            return [];
        }
        
        $result = [];
        foreach ($addresses as $address) {
            $result[] = [
                'email' => $address->getAddress(),
                'name' => $address->getName(),
            ];
        }
        
        return $result;
    }
}
