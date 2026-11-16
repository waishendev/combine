<?php
namespace Tests\Unit;
use PHPUnit\Framework\TestCase;
class PrintPlatformArchitectureTest extends TestCase
{
    public function test_phase_one_contract_is_present(): void
    {
        $root=dirname(__DIR__,2);
        $migration=file_get_contents($root.'/database/migrations/2027_03_11_000001_create_print_platform_tables.php');
        foreach(['print_devices','print_device_pairing_codes','printers','print_jobs','print_job_attempts'] as $table) $this->assertStringContainsString("Schema::create('{$table}'",$migration);
        $service=file_get_contents($root.'/app/Services/PrintPlatform/PrintJobService.php');
        foreach(['pending','claimed','processing','succeeded','retry_wait','failed','cancelled'] as $status) $this->assertStringContainsString("'{$status}'",$service);
        $event=file_get_contents($root.'/app/Events/PrintJobAvailable.php');
        $this->assertStringContainsString('print.job.available',$event);
        $this->assertStringNotContainsString("'payload'=>",$event);
    }
}
