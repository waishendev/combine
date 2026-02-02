import { Switch } from "@headlessui/react";
import CustomDateTimePicker from "./CustomDateTimePicker"; // 你之前用的时间组件
import { Category } from "./types";

export type FieldType = "number" | "boolean" | "time" | "select";

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
}

interface Printer {
  id: number;
  name: string;
}

interface Props {
  field: FieldConfig;
  value: any;
  onChange: (val: any) => void;
  printers?: Printer[];
  categories?: Category[];
  allValues?: Record<string, any>; // ✅ 用于 time 组合字段
  setValues?: React.Dispatch<React.SetStateAction<Record<string, any>>>; // ✅ 用于可控更新
}


export default function FieldRenderer({ field, value, onChange,printers,categories,allValues, setValues }: Props) {
  if (field.type === "boolean") {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="text-sm">{field.label}</span>
        <Switch
            checked={!!value}
            onChange={onChange}
            className={`${
            value ? "bg-green-500" : "bg-gray-300"
            } relative inline-flex h-6 w-11 items-center rounded-full`}
        >
            <span
            className={`${
                value ? "translate-x-6" : "translate-x-1"
            } inline-block h-4 w-4 transform rounded-full bg-white transition`}
            />
        </Switch>
        </div>
    );
  }

if (field.type === "time" && allValues && setValues) {
  return (
    
    <div className="grid sm:grid-cols-2 gap-4">
        <div>
            <CustomDateTimePicker
                label="Available From"
                value={allValues.available_from}
                onChange={(val) =>
                setValues((prev) => ({ ...prev, available_from: val }))
                }
                showDate={false}
            />
        </div>
         <div>
            <CustomDateTimePicker
                label="Available To"
                value={allValues.available_to}
                onChange={(val) =>
                setValues((prev) => ({ ...prev, available_to: val }))
                }
                showDate={false}
            />
        </div>
    </div>
  );
}

if (field.type === "select") {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        required
      >
        {field.key === "printer_id" && (
          <>
            <option value="">Select printer</option>
            {printers?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </>
        )}
        {field.key === "product_type_id" && (
          <>
            <option value="">Select a category</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.en_name})
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}


  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">
        {field.label}
      </label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
