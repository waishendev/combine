import { useEffect, useState } from "react";
import FieldRenderer, { FieldConfig, FieldType } from "./FileRender";
import { swalWithComfirmButton } from "@/utils/notify";
import { Category } from "./types";

const FIELD_CONFIG: FieldConfig[] = [
  { key: "stock", label: "Stock", type: "number" },
  { key: "member_discount_percent", label: "Member Price (%)", type: "number" },
  { key: "is_active", label: "Active", type: "boolean" },
  { key: "is_member_price", label: "Enable Member Price", type: "boolean" },
  { key: "available_time", label: "Available Time", type: "time" },
  { key: "printer_id", label: "Printer", type: "select" },
  { key: "product_type_id", label: "Category", type: "select" },
];

interface Product {
  id: number;
}

interface Printer {
  id: number;
  name: string;
}

interface Props {
  selectedProducts: Product[];
  userToken?: string;
  onClose: () => void;
  fetchProducts: () => void;
}

export default function MultiFieldForm({
  selectedProducts,
  userToken,
  onClose,
  fetchProducts,
}: Props) {
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [values, setValues] = useState<Record<string, any>>({});
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [errorMessages, setErrorMessages] = useState<string[]>([]);
  // 🔄 获取 printer 列表
  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/printers`, {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });
        const json = await res.json();
        setPrinters(json.data || []);
      } catch {
        console.error("Failed to load printers");
      }
    };
    fetchPrinters();
  }, [userToken]);

  // 🔄 获取 category 列表
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/product-types?per_page=200`,
          {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          }
        );
        const json = await res.json();
        setCategories(json.data || []);
      } catch (err) {
        setErrorMessages(["Failed to fetch categories."]);
      }
    };

    if (userToken) fetchCategories();
  }, [userToken]);

    const getDefaultValue = (type: FieldType) => {
    switch (type) {
        case "boolean":
        return false;
        case "number":
        return 0;
        case "select":
        return "";
        case "time":
        return { available_from: "00:00:00", available_to: "23:59:59" };
        default:
        return null;
    }
    };

    // ✅ Checkbox toggle
const toggleField = (key: string) => {
  setSelectedFields((prev) => {
    const isAdding = !prev.includes(key);
    const updated = isAdding ? [...prev, key] : prev.filter((f) => f !== key);

    const config = FIELD_CONFIG.find((f) => f.key === key);
    if (!config) return updated;

    if (isAdding) {
      const defaultValue = getDefaultValue(config.type);
      if (config.type === "time") {
        setValues((prevVal) => ({
          ...prevVal,
          available_from: "00:00:00",
          available_to: "23:59:59",
        }));
      } else {
        setValues((prevVal) => ({
          ...prevVal,
          [key]: defaultValue,
        }));
      }
    } else {
      if (config.type === "time") {
        setValues((prevVal) => {
          const { available_from, available_to, ...rest } = prevVal;
          return rest;
        });
      } else {
        setValues((prevVal) => {
          const newVal = { ...prevVal };
          delete newVal[key];
          return newVal;
        });
      }
    }

    return updated;
  });
};


  // ✅ 改值
  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ 提交逻辑（包含 printer_id 与 time 拆分）
  const handleSubmit = async () => {
    const payload: any = {
      ids: selectedProducts.map((p) => p.id),
    };

    for (const key of selectedFields) {
      if (key === "available_time") {
        if (values.available_from || values.available_to) {
          payload.available_from = values.available_from;
          payload.available_to = values.available_to;
        }
      } else if (values[key] !== undefined) {
        payload[key] = values[key];
      }
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/products/bulk`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

        if (!res.ok) {
        const json = await res.json();
        const errs = json.errors ? Object.values(json.errors).flat() : [json.message];
        setErrorMessages(errs as string[]);
        return;
        }
        swalWithComfirmButton('Bulk Update Success', 'Products have been updated successfully', 'success');
        fetchProducts();
        onClose();
    } catch (err) {
        setErrorMessages(["An unknown error occurred"]);
    }
  };

  return (
    <>
     {errorMessages.length > 0 && (
          <div className='max-w-6xl mx-auto'>
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm mb-5">
              {errorMessages.length === 1 ? (
                  <div>
                  <strong className="font-semibold">Error:</strong>{' '}
                  {errorMessages[0]}
                  </div>
              ) : (
                  <>
                  <strong className="font-semibold block mb-1">Errors:</strong>
                  {errorMessages.map((msg, idx) => (
                      <div key={idx}>
                      {idx + 1}. {msg}
                      </div>
                  ))}
                  </>
              )}
              </div>
          </div>
      )}
        <div className="space-y-6">
      {/* ✅ 美化字段选择 */}
        <div>
        <h3 className="text-md font-semibold text-gray-800 mb-3">
        Select Fields to Update <span className="text-gray-500">(you can choose more than one)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FIELD_CONFIG.map((field) => {
            const isSelected = selectedFields.includes(field.key);
            return (
                <button
                key={field.key}
                onClick={() => toggleField(field.key)}
                type="button"
                className={`group flex items-center gap-3 p-4 rounded-xl border transition shadow-sm
                    ${isSelected
                    ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300"
                    : "bg-white hover:bg-gray-50 border-gray-300"}`}
                >
                {/* 图标区域（如果你愿意加） */}
                <div
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-xs font-bold
                    ${isSelected ? "bg-indigo-500" : "bg-gray-300 group-hover:bg-gray-400"}`}
                >
                    ✓
                </div>

                {/* Label */}
                <span className="text-sm font-medium text-gray-800">{field.label}</span>
                </button>
            );
            })}
        </div>
        </div>



      {/* ✅ 渲染字段输入框 */}
      <div className="space-y-4">
        {selectedFields.map((key) => {
          const config = FIELD_CONFIG.find((f) => f.key === key);
          if (!config) return null;
          return (
            <FieldRenderer
              key={key}
              field={config}
              value={values[key]}
              onChange={(val) => handleChange(key, val)}
              printers={printers}
              categories={categories}
              allValues={values} // optional
              setValues={setValues} // for time field
            />
          );
        })}
      </div>

      {/* ✅ 提交按钮 */}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm border rounded">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded"
        >
          Confirm
        </button>
      </div>
    </div>
    </>
  );
}
