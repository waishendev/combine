<?php

namespace Tests\Unit;

use App\Services\Ecommerce\StaffSplitNormalizer;
use Tests\TestCase;

class StaffSplitNormalizerTest extends TestCase
{
    public function test_amount_mode_normalizes_to_exact_amounts_and_integer_percents(): void
    {
        $normalizer = new StaffSplitNormalizer();
        $result = $normalizer->normalize([
            ['staff_id' => 1, 'share_amount' => 30],
            ['staff_id' => 2, 'share_amount' => 70],
        ], 100, StaffSplitNormalizer::MODE_AMOUNT);

        $this->assertNull($result['error']);
        $this->assertCount(2, $result['splits']);
        $this->assertSame(30, $result['splits'][0]['share_percent']);
        $this->assertSame(70, $result['splits'][1]['share_percent']);
        $this->assertSame(30.0, $result['splits'][0]['share_amount']);
        $this->assertSame(70.0, $result['splits'][1]['share_amount']);
    }

    public function test_amount_mode_rejects_totals_that_do_not_match_line_total(): void
    {
        $normalizer = new StaffSplitNormalizer();
        $result = $normalizer->normalize([
            ['staff_id' => 1, 'share_amount' => 30],
            ['staff_id' => 2, 'share_amount' => 60],
        ], 100, StaffSplitNormalizer::MODE_AMOUNT);

        $this->assertNotNull($result['error']);
        $this->assertSame([], $result['splits']);
    }

    public function test_normalize_incoming_respects_split_mode_amount(): void
    {
        $normalizer = new StaffSplitNormalizer();
        $result = $normalizer->normalizeIncoming([
            ['staff_id' => 1, 'share_percent' => 67, 'share_amount' => 20, 'split_mode' => 'amount'],
            ['staff_id' => 2, 'share_percent' => 33, 'share_amount' => 10, 'split_mode' => 'amount'],
        ], 30);

        $this->assertNull($result['error']);
        $this->assertSame(20.0, $result['splits'][0]['share_amount']);
        $this->assertSame(10.0, $result['splits'][1]['share_amount']);
    }

    public function test_find_line_staff_split_payload_matches_pos_service_keys(): void
    {
        $payloads = [[
            'line_key' => 'service:12:main:5',
            'staff_splits' => [
                ['staff_id' => 1, 'share_percent' => 67, 'share_amount' => 20, 'split_mode' => 'amount'],
            ],
        ]];

        $matched = StaffSplitNormalizer::findLineStaffSplitPayload($payloads, 'main');
        $this->assertNotNull($matched);
        $this->assertSame('service:12:main:5', $matched['line_key']);

        $addonPayloads = [[
            'line_key' => 'service:12:addon:9',
            'staff_splits' => [
                ['staff_id' => 2, 'share_percent' => 100, 'share_amount' => 30, 'split_mode' => 'amount'],
            ],
        ]];
        $addonMatched = StaffSplitNormalizer::findLineStaffSplitPayload($addonPayloads, 'addon:9');
        $this->assertNotNull($addonMatched);
        $this->assertSame('service:12:addon:9', $addonMatched['line_key']);
    }

    public function test_to_report_split_shows_amount_only_in_amount_mode(): void
    {
        $percentSplit = StaffSplitNormalizer::toReportSplit([
            'staff_id' => 1,
            'share_percent' => 50,
            'share_amount' => 250,
            'split_mode' => 'percent',
        ], 'Alice');

        $this->assertSame('percent', $percentSplit['split_mode']);
        $this->assertNull($percentSplit['share_amount']);
        $this->assertSame(50, $percentSplit['share_percent']);

        $amountSplit = StaffSplitNormalizer::toReportSplit([
            'staff_id' => 2,
            'share_percent' => 50,
            'share_amount' => 250,
            'split_mode' => 'amount',
        ], 'Bob');

        $this->assertSame('amount', $amountSplit['split_mode']);
        $this->assertSame(250.0, $amountSplit['share_amount']);
    }
}
