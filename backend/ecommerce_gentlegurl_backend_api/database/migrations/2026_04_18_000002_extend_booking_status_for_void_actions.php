<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if ($this->hasPostgresEnumType('bookings_status_enum')) {
            DB::statement("ALTER TYPE bookings_status_enum ADD VALUE IF NOT EXISTS 'VOIDED'");
        } else {
            $this->replaceCheckConstraint(
                table: 'bookings',
                column: 'status',
                values: [
                    'HOLD',
                    'CONFIRMED',
                    'COMPLETED',
                    'CANCELLED',
                    'LATE_CANCELLATION',
                    'NO_SHOW',
                    'NOTIFIED_CANCELLATION',
                    'EXPIRED',
                    'VOIDED',
                ],
            );
        }

        if ($this->hasPostgresEnumType('booking_payments_status_enum')) {
            DB::statement("ALTER TYPE booking_payments_status_enum ADD VALUE IF NOT EXISTS 'VOIDED'");
        } else {
            $this->replaceCheckConstraint(
                table: 'booking_payments',
                column: 'status',
                values: ['PENDING', 'PAID', 'FAILED', 'VOIDED'],
            );
        }
    }

    public function down(): void
    {
        // Enum value removal is intentionally omitted for PostgreSQL safety.
    }

    private function hasPostgresEnumType(string $typeName): bool
    {
        $row = DB::selectOne('SELECT to_regtype(?) AS type_name', [$typeName]);

        return isset($row->type_name) && $row->type_name !== null;
    }

    /**
     * Replace status check constraints for installations that don't use native enum types.
     */
    private function replaceCheckConstraint(string $table, string $column, array $values): void
    {
        $allowedValues = collect($values)
            ->map(fn (string $value) => "'" . str_replace("'", "''", $value) . "'")
            ->implode(', ');

        $newConstraintName = "{$table}_{$column}_check";
        $constraintPattern = '%' . $column . '%';

        $constraints = DB::select(
            <<<SQL
SELECT conname
FROM pg_constraint
WHERE conrelid = ?::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE ?
SQL,
            [$table, $constraintPattern]
        );

        foreach ($constraints as $constraint) {
            if (! isset($constraint->conname)) {
                continue;
            }

            $escapedConstraintName = str_replace('"', '""', (string) $constraint->conname);
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT \"{$escapedConstraintName}\"");
        }

        DB::statement(
            "ALTER TABLE {$table} ADD CONSTRAINT {$newConstraintName} CHECK ({$column} IN ({$allowedValues}))"
        );
    }
};
