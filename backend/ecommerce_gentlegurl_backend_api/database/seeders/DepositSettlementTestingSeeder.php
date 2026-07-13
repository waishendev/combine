<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingService;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderItemStaffSplit;
use App\Models\Ecommerce\OrderServiceItem;
use App\Models\Staff;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seeds COMPLETED bookings with an old deposit order (no settlement yet).
 *
 * Run: php artisan db:seed --class=DepositSettlementTestingSeeder
 *
 * Then in CRM → POS → Appointments: find the booking, Edit Settlement if needed, collect settlement.
 * Check Sales Visual / My Sales: deposit (old date) + settlement (today) should both count for staff.
 */
class DepositSettlementTestingSeeder extends Seeder
{
    private const SERVICE_NAME = 'Deposit Settlement Test Service';

    public function run(): void
    {
        date_default_timezone_set('Asia/Kuala_Lumpur');

        $staffIds = Staff::query()->orderBy('id')->limit(3)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (count($staffIds) < 2) {
            $this->command?->warn('Need at least 2 staff rows. Run BookingTestingSeeder or StaffPermissionSeeder first.');

            return;
        }

        $userId = (int) (User::query()->orderBy('id')->value('id') ?? 0);
        if ($userId <= 0) {
            $this->command?->warn('No users found. Run AdminSeeder first.');

            return;
        }

        $customerId = (int) (Customer::query()->orderBy('id')->value('id') ?? 0);
        if ($customerId <= 0) {
            $this->command?->warn('No customers found. Run DemoMembersSeederTesting first.');

            return;
        }

        $service = $this->resolveTestService();
        $staffSplits = $this->buildStaffSplitRows($staffIds, [34, 33, 33]);

        $scenarios = [
            [
                'booking_code' => 'BKG-DEPSET-2D',
                'order_number' => 'POS-SEED-DEP-2D',
                'deposit_days_ago' => 2,
                'label' => '2-day-old deposit',
            ],
            [
                'booking_code' => 'BKG-DEPSET-5D',
                'order_number' => 'POS-SEED-DEP-5D',
                'deposit_days_ago' => 5,
                'label' => '5-day-old deposit',
            ],
        ];

        foreach ($scenarios as $scenario) {
            $booking = $this->seedDepositOnlyBooking(
                $scenario,
                $service,
                $customerId,
                (int) $staffIds[0],
                $staffSplits,
                $userId,
            );

            $this->command?->info(sprintf(
                '[%s] booking_id=%d code=%s | service RM %.2f, deposit RM %.2f paid %d day(s) ago, balance due RM %.2f',
                $scenario['label'],
                $booking->id,
                $booking->booking_code,
                75.00,
                15.00,
                $scenario['deposit_days_ago'],
                60.00,
            ));
        }

        $this->command?->newLine();
        $this->command?->info('Next steps:');
        $this->command?->line('  1. Open CRM → POS → Appointments');
        $this->command?->line('  2. Search booking codes: BKG-DEPSET-2D / BKG-DEPSET-5D');
        $this->command?->line('  3. Complete settlement checkout (balance RM 60.00 each)');
        $this->command?->line('  4. Verify Sales Visual / My Sales includes deposit RM 15 + settlement RM 60 = RM 75 per staff share');
    }

    private function resolveTestService(): BookingService
    {
        $payload = [
            'name' => self::SERVICE_NAME,
            'description' => 'Fixed-price service for deposit vs settlement report testing.',
            'service_type' => 'standard',
            'duration_min' => 60,
            'deposit_amount' => 15,
            'buffer_min' => 15,
            'is_active' => true,
        ];

        if (Schema::hasColumn('booking_services', 'cn_name')) {
            $payload['cn_name'] = '订金结算测试';
        }
        if (Schema::hasColumn('booking_services', 'service_price')) {
            $payload['service_price'] = 75;
        }
        if (Schema::hasColumn('booking_services', 'price_mode')) {
            $payload['price_mode'] = 'fixed';
        }

        return BookingService::query()->updateOrCreate(
            ['name' => self::SERVICE_NAME],
            $payload,
        );
    }

    /**
     * @param  array<int, int>  $staffIds
     * @param  array<int, int>  $percents
     * @return array<int, array<string, mixed>>
     */
    private function buildStaffSplitRows(array $staffIds, array $percents): array
    {
        $rows = [];
        foreach ($staffIds as $index => $staffId) {
            $staff = Staff::query()->find($staffId);
            $rows[] = [
                'staff_id' => $staffId,
                'staff_name' => (string) ($staff->name ?? ('Staff #' . $staffId)),
                'share_percent' => (int) ($percents[$index] ?? 0),
                'split_mode' => 'percent',
            ];
        }

        return array_values(array_filter($rows, fn (array $row) => $row['share_percent'] > 0));
    }

    /**
     * @param  array{booking_code:string,order_number:string,deposit_days_ago:int,label:string}  $scenario
     * @param  array<int, array<string, mixed>>  $staffSplits
     */
    private function seedDepositOnlyBooking(
        array $scenario,
        BookingService $service,
        int $customerId,
        int $primaryStaffId,
        array $staffSplits,
        int $userId,
    ): Booking {
        $serviceTotal = 75.00;
        $depositAmount = 15.00;
        $depositPaidAt = Carbon::now('Asia/Kuala_Lumpur')->subDays((int) $scenario['deposit_days_ago'])->setTime(11, 30);
        $appointmentStart = $depositPaidAt->copy()->addDay()->setTime(14, 0);
        $completedAt = $appointmentStart->copy()->addMinutes((int) $service->duration_min);

        $originalMainLine = [
            'item_kind' => 'main_service',
            'is_original' => true,
            'name' => (string) $service->name,
            'cn_name' => $service->cn_name ?? null,
            'extra_price' => $serviceTotal,
            'linked_booking_service_id' => (int) $service->id,
            'price_finalized' => true,
            'staff_splits' => $staffSplits,
            'addon_items' => [],
        ];

        $booking = Booking::query()->updateOrCreate(
            ['booking_code' => $scenario['booking_code']],
            [
                'source' => 'STAFF',
                'customer_id' => $customerId,
                'guest_name' => null,
                'guest_phone' => null,
                'guest_email' => null,
                'staff_id' => $primaryStaffId,
                'service_id' => (int) $service->id,
                'start_at' => $appointmentStart,
                'end_at' => $appointmentStart->copy()->addMinutes((int) $service->duration_min),
                'buffer_min' => (int) ($service->buffer_min ?? 15),
                'status' => 'COMPLETED',
                'deposit_amount' => $depositAmount,
                'addon_duration_min' => 0,
                'addon_price' => 0,
                'addon_items_json' => [$originalMainLine],
                'settled_service_amount' => $serviceTotal,
                'payment_status' => 'PARTIAL',
                'completed_at' => $completedAt,
                'commission_counted_at' => null,
                'created_by_staff_id' => $primaryStaffId,
                'notes' => sprintf(
                    'DepositSettlementTestingSeeder — %s. Deposit RM %.2f on %s; settle RM %.2f manually in POS Appointments.',
                    $scenario['label'],
                    $depositAmount,
                    $depositPaidAt->toDateString(),
                    $serviceTotal - $depositAmount,
                ),
            ],
        );

        DB::table('booking_service_staff_splits')->where('booking_id', (int) $booking->id)->delete();
        $commissionRates = Staff::query()->whereIn('id', collect($staffSplits)->pluck('staff_id')->all())->pluck('service_commission_rate', 'id');
        DB::table('booking_service_staff_splits')->insert(
            collect($staffSplits)->map(fn (array $split) => [
                'booking_id' => (int) $booking->id,
                'staff_id' => (int) $split['staff_id'],
                'split_percent' => (int) $split['share_percent'],
                'share_amount' => null,
                'split_mode' => 'percent',
                'service_commission_rate_snapshot' => (float) ($commissionRates[(int) $split['staff_id']] ?? 0),
                'created_at' => $depositPaidAt,
                'updated_at' => $depositPaidAt,
            ])->all(),
        );

        $this->removeExistingDepositOrders((int) $booking->id);

        $depositOrder = Order::query()->create([
            'order_number' => $scenario['order_number'],
            'customer_id' => $customerId,
            'created_by_user_id' => $userId,
            'status' => 'completed',
            'payment_status' => 'paid',
            'payment_method' => 'cash',
            'payment_provider' => 'manual',
            'subtotal' => $depositAmount,
            'discount_total' => 0,
            'shipping_fee' => 0,
            'grand_total' => $depositAmount,
            'pickup_or_shipping' => 'in_store',
            'placed_at' => $depositPaidAt,
            'paid_at' => $depositPaidAt,
            'completed_at' => $depositPaidAt,
            'notes' => 'DepositSettlementTestingSeeder deposit | booking_id=' . $booking->id . ' | booking_deposit=' . number_format($depositAmount, 2, '.', ''),
            'created_at' => $depositPaidAt,
            'updated_at' => $depositPaidAt,
        ]);

        if (Schema::hasTable('order_payments')) {
            DB::table('order_payments')->insert([
                'order_id' => (int) $depositOrder->id,
                'payment_method' => 'cash',
                'amount' => $depositAmount,
                'reference_no' => null,
                'meta' => json_encode(['source' => 'DepositSettlementTestingSeeder']),
                'created_at' => $depositPaidAt,
                'updated_at' => $depositPaidAt,
            ]);
        }

        $primaryRate = (float) ($commissionRates[$primaryStaffId] ?? 0);
        OrderServiceItem::query()->create([
            'order_id' => (int) $depositOrder->id,
            'booking_id' => (int) $booking->id,
            'booking_service_id' => (int) $service->id,
            'customer_id' => $customerId,
            'service_name_snapshot' => (string) $service->name,
            'price_snapshot' => $serviceTotal,
            'qty' => 1,
            'line_total' => $serviceTotal,
            'assigned_staff_id' => $primaryStaffId,
            'start_at' => $appointmentStart,
            'end_at' => $appointmentStart->copy()->addMinutes((int) $service->duration_min),
            'staff_splits' => $staffSplits,
            'commission_rate_used' => $primaryRate,
            'commission_amount' => round($serviceTotal * $primaryRate, 2),
            'item_type' => 'service',
            'created_at' => $depositPaidAt,
            'updated_at' => $depositPaidAt,
        ]);

        $depositOrderItem = OrderItem::query()->create([
            'order_id' => (int) $depositOrder->id,
            'line_type' => 'booking_deposit',
            'product_name_snapshot' => 'Booking Deposit - ' . $service->name,
            'display_name_snapshot' => 'Booking Deposit - ' . $service->name,
            'quantity' => 1,
            'price_snapshot' => $depositAmount,
            'unit_price_snapshot' => $depositAmount,
            'line_total' => $depositAmount,
            'line_total_snapshot' => $depositAmount,
            'effective_unit_price' => $depositAmount,
            'effective_line_total' => $depositAmount,
            'line_total_after_discount' => $depositAmount,
            'locked' => true,
            'booking_id' => (int) $booking->id,
            'booking_service_id' => (int) $service->id,
            'created_at' => $depositPaidAt,
            'updated_at' => $depositPaidAt,
        ]);

        foreach ($staffSplits as $split) {
            $staffId = (int) $split['staff_id'];
            $sharePercent = (int) $split['share_percent'];
            $shareAmount = round($depositAmount * ($sharePercent / 100), 2);

            OrderItemStaffSplit::query()->create([
                'order_item_id' => (int) $depositOrderItem->id,
                'line_type' => 'booking_deposit',
                'line_ref_id' => (string) $service->id,
                'staff_id' => $staffId,
                'share_percent' => $sharePercent,
                'share_amount' => $shareAmount,
                'split_mode' => 'percent',
                'amount_basis' => $depositAmount,
                'commission_rate_snapshot' => (float) ($commissionRates[$staffId] ?? 0),
                'snapshot' => [
                    'booking_id' => (int) $booking->id,
                    'booking_service_id' => (int) $service->id,
                    'source' => 'DepositSettlementTestingSeeder',
                ],
                'created_at' => $depositPaidAt,
                'updated_at' => $depositPaidAt,
            ]);
        }

        BookingPayment::query()->updateOrCreate(
            [
                'booking_id' => (int) $booking->id,
                'provider' => 'cash',
            ],
            [
                'ref' => $scenario['order_number'],
                'amount' => $depositAmount,
                'status' => 'PAID',
                'raw_response' => [
                    'source' => 'DepositSettlementTestingSeeder',
                    'order_id' => (int) $depositOrder->id,
                    'paid_at' => $depositPaidAt->toIso8601String(),
                ],
                'created_at' => $depositPaidAt,
                'updated_at' => $depositPaidAt,
            ],
        );

        return $booking->fresh(['service', 'customer', 'staff']);
    }

    private function removeExistingDepositOrders(int $bookingId): void
    {
        $orderIds = Order::query()
            ->where('notes', 'like', '%DepositSettlementTestingSeeder deposit%')
            ->where('notes', 'like', '%booking_id=' . $bookingId . '%')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($orderIds === []) {
            return;
        }

        $orderItemIds = OrderItem::query()->whereIn('order_id', $orderIds)->pluck('id')->all();
        if ($orderItemIds !== []) {
            OrderItemStaffSplit::query()->whereIn('order_item_id', $orderItemIds)->delete();
            OrderItem::query()->whereIn('id', $orderItemIds)->delete();
        }

        OrderServiceItem::query()->whereIn('order_id', $orderIds)->delete();

        if (Schema::hasTable('order_payments')) {
            DB::table('order_payments')->whereIn('order_id', $orderIds)->delete();
        }

        Order::query()->whereIn('id', $orderIds)->delete();
    }
}
