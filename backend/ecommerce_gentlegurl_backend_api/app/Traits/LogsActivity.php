<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model) {
            static::recordActivity('created', $model);
        });

        static::updated(function (Model $model) {
            if ($model->wasChanged()) {
                static::recordActivity('updated', $model);
            }
        });

        static::deleted(function (Model $model) {
            static::recordActivity('deleted', $model);
        });
    }

    protected static function recordActivity(string $action, Model $model): void
    {
        $user = Auth::guard('web')->user() ?? Auth::guard('sanctum')->user();

        $oldValues = null;
        $newValues = null;

        if ($action === 'updated') {
            $changed = $model->getChanges();
            unset($changed['updated_at']);
            $original = collect($model->getOriginal())
                ->only(array_keys($changed))
                ->toArray();

            if (empty($changed)) {
                return;
            }

            $oldValues = $original;
            $newValues = $changed;
        } elseif ($action === 'created') {
            $newValues = collect($model->getAttributes())
                ->except(['id', 'created_at', 'updated_at', 'password', 'remember_token'])
                ->toArray();
        } elseif ($action === 'deleted') {
            $oldValues = collect($model->getAttributes())
                ->except(['created_at', 'updated_at', 'password', 'remember_token'])
                ->toArray();
        }

        $shortType = class_basename($model);

        ActivityLog::create([
            'user_id' => $user?->id,
            'user_name' => $user?->name ?? $user?->username ?? null,
            'action' => $action,
            'model_type' => $shortType,
            'model_id' => $model->getKey(),
            'model_label' => static::resolveModelLabel($model),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }

    protected static function resolveModelLabel(Model $model): ?string
    {
        foreach (['name', 'title', 'order_number', 'slug', 'email', 'username'] as $field) {
            if (!empty($model->getAttribute($field))) {
                return (string) $model->getAttribute($field);
            }
        }

        return null;
    }
}
