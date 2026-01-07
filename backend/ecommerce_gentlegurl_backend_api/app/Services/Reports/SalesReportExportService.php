<?php

namespace App\Services\Reports;

class SalesReportExportService
{
    public function writeCsvHeader($handle, array $columns): void
    {
        fputcsv($handle, $columns);
    }

    public function writeCsvRow($handle, array $row): void
    {
        fputcsv($handle, $row);
    }

    public function writeCsvTotalsRow(
        $handle,
        array $columns,
        array $totals,
        string $label = 'TOTAL'
    ): void {
        $row = [];
        foreach ($columns as $index => $column) {
            if ($index === 0) {
                $row[] = $label;
                continue;
            }
            $row[] = $totals[$column] ?? null;
        }

        $this->writeCsvRow($handle, $row);
    }
}
