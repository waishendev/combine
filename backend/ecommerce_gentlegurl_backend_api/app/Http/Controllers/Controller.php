<?php

namespace App\Http\Controllers;

abstract class Controller
{
    protected function respond(mixed $data = null, ?string $message = null, bool $success = true, int $status = 200)
    {
        return response()->json([
            'data' => $data,
            'message' => $message,
            'success' => $success,
        ], $status);
    }

    protected function respondError(?string $message = null, int $status = 400, mixed $data = null)
    {
        return $this->respond($data, $message, false, $status);
    }
}
