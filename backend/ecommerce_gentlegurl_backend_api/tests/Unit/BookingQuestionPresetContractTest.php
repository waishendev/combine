<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class BookingQuestionPresetContractTest extends TestCase
{
    public function test_preset_tables_and_service_question_link_exist(): void
    {
        $migration = $this->backend('database/migrations/2026_09_25_000010_create_booking_question_presets_tables.php');
        $this->assertStringContainsString("Schema::create('booking_question_presets'", $migration);
        $this->assertStringContainsString("Schema::create('booking_question_preset_questions'", $migration);
        $this->assertStringContainsString("Schema::create('booking_question_preset_options'", $migration);
        $this->assertStringContainsString("Schema::create('booking_service_question_presets'", $migration);
        $this->assertStringContainsString("question_preset_id", $migration);
        $this->assertStringContainsString("source_preset_question_id", $migration);
    }

    public function test_sync_service_materializes_and_propagates(): void
    {
        $sync = $this->backend('app/Services/Booking/BookingQuestionPresetSyncService.php');
        $controller = $this->backend('app/Http/Controllers/Admin/Booking/QuestionPresetController.php');
        $serviceController = $this->backend('app/Http/Controllers/Admin/Booking/ServiceController.php');

        $this->assertStringContainsString('syncPresetToAttachedServices', $sync);
        $this->assertStringContainsString('rematerializeServiceQuestions', $sync);
        $this->assertStringContainsString('extractCustomQuestionPayloads', $sync);
        $this->assertStringContainsString('orderedPresetIdsForService', $sync);
        $this->assertStringContainsString('syncPresetToAttachedServices', $controller);
        $this->assertStringContainsString('questionPresetSync->syncServiceQuestions', $serviceController);
        $this->assertStringContainsString('question_preset_ids', $serviceController);
        $this->assertStringContainsString('filterCustomQuestionPayloads', $serviceController);
        $this->assertStringContainsString("allowed_staff_by_store_location.*.*' => ['integer']", $serviceController);
        $this->assertStringNotContainsString("allowed_staff_by_store_location.*.*' => ['integer', 'distinct']", $serviceController);
    }

    public function test_crm_presets_page_and_service_attach_ui_exist(): void
    {
        $page = $this->frontendApp('question-presets/page.tsx');
        $builder = $this->frontend('BookingServiceQuestionsBuilder.tsx');
        $picker = $this->frontend('BookingServiceQuestionPresetPickerModal.tsx');
        $view = $this->frontend('BookingServiceQuestionPresetViewModal.tsx');
        $edit = $this->frontend('BookingServiceEditModal.tsx');
        $create = $this->frontend('BookingServiceCreateModal.tsx');
        $sidebar = (string) file_get_contents(dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/components/Sidebar.tsx');

        $this->assertStringContainsString('BookingQuestionPresetsTable', $page);
        $this->assertStringContainsString('Use question preset', $builder);
        $this->assertStringContainsString('Preset name', $builder);
        $this->assertStringContainsString("kind: 'preset'", $builder);
        $this->assertStringContainsString('Apply question presets', $picker);
        $this->assertStringContainsString('fa-eye', $picker);
        $this->assertStringContainsString('Create new preset', $picker);
        $this->assertStringContainsString('Select presets to add', $picker);
        $this->assertStringContainsString('Full preset details', $view);
        $this->assertStringContainsString('Linked add-on', $view);
        $this->assertStringContainsString('Option label', $view);
        $this->assertStringContainsString('enablePresets', $edit);
        $this->assertStringContainsString('question_presets_touched', $edit);
        $this->assertStringContainsString('question_preset_ids', $edit);
        $this->assertStringContainsString('enablePresets', $create);
        $bulk = $this->frontend('BookingServiceBulkUpdateModal.tsx');
        $this->assertStringContainsString('enablePresets', $bulk);
        $this->assertStringContainsString('question_preset_ids', $bulk);
        $this->assertStringContainsString('/booking/question-presets', $sidebar);
    }

    private function backend(string $path): string
    {
        return (string) file_get_contents(dirname(__DIR__, 2).'/'.$path);
    }

    private function frontend(string $file): string
    {
        return (string) file_get_contents(dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/components/booking/'.$file);
    }

    private function frontendApp(string $file): string
    {
        return (string) file_get_contents(
            dirname(__DIR__, 4).'/frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/booking/'.$file
        );
    }
}
