<?php
namespace App\Events;
use App\Models\PrintJob;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
class PrintJobAvailable implements ShouldBroadcastNow
{
    public function __construct(public PrintJob $job, public string $reason = 'created') {}
    public function broadcastOn(): array { return [new PrivateChannel('print-device.'.$this->job->device->uuid)]; }
    public function broadcastAs(): string { return 'print.job.available'; }
    public function broadcastWith(): array { return ['job_id'=>$this->job->id,'reason'=>$this->reason]; }
}
