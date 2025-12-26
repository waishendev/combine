import { useI18n } from "@/lib/i18n";


interface TableLoadingRowProps {
  colSpan: number;
  message?: string;
}

export default function TableLoadingRow({ colSpan, message }: TableLoadingRowProps) {
  const { t } = useI18n();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
        <div
          className="flex items-center justify-center h-[120px]"
          role="status"
          aria-live="polite"
        >
          <i className="fa fa-spinner fa-spin mr-2" />
          {message ?? t("table.loading_data")}
        </div>
      </td>
    </tr>
  );
}
