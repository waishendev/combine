<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\NotificationTemplate;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationTemplateController extends Controller
{
    public function index()
    {
        $templates = NotificationTemplate::orderBy('key')->get();

        return $this->respond($templates);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request, true);

        $template = NotificationTemplate::create($validated);

        return $this->respond($template, __('Notification template created successfully.'));
    }

    public function show(NotificationTemplate $notificationTemplate)
    {
        return $this->respond($notificationTemplate);
    }

    public function update(Request $request, NotificationTemplate $notificationTemplate)
    {
        $validated = $this->validatePayload($request, false, $notificationTemplate->id);

        $notificationTemplate->fill($validated);
        $notificationTemplate->save();

        return $this->respond($notificationTemplate, __('Notification template updated successfully.'));
    }

    public function destroy(NotificationTemplate $notificationTemplate)
    {
        $notificationTemplate->delete();

        return $this->respond(null, __('Notification template deleted successfully.'));
    }

    protected function validatePayload(Request $request, bool $isCreate = false, ?int $templateId = null): array
    {
        return $request->validate([
            'key' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:100', Rule::unique('notification_templates', 'key')->ignore($templateId)],
            'channel' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:30'],
            'name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:150'],
            'subject_template' => ['nullable', 'string', 'max:255'],
            'body_template' => [$isCreate ? 'required' : 'sometimes', 'string'],
            'variables' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
