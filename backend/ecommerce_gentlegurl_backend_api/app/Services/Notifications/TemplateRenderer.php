<?php

namespace App\Services\Notifications;

use App\Models\Ecommerce\NotificationTemplate;

class TemplateRenderer
{
    public function getTemplate(string $eventKey, string $channel): ?NotificationTemplate
    {
        return NotificationTemplate::where('key', $eventKey)
            ->where('channel', $channel)
            ->where('is_active', true)
            ->first();
    }

    public function render(string $template, array $data): string
    {
        $replacements = [];
        foreach ($data as $key => $value) {
            $replacements['{{' . $key . '}}'] = (string) $value;
        }

        return strtr($template, $replacements);
    }

    public function renderSubject(?string $template, array $data): ?string
    {
        if ($template === null) {
            return null;
        }

        return $this->render($template, $data);
    }
}
