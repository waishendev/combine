import { useState } from 'react'
import { resolveImageUrl } from '@/utils/resolveImageUrl'
import MultiFieldForm from './MultiFieldForm'

interface Product {
  id: number
  name: string
  en_name?: string
  stock: number
  thumbnail_url?: string
  selected?: boolean
}

interface BulkUpdateModalProps {
  show: boolean
  onClose: () => void
  selectedProducts: Product[]
  fetchProducts: () => void
}

export default function BulkUpdateModal({
  show,
  onClose,
  selectedProducts,
  fetchProducts,
}: BulkUpdateModalProps) {
  const [showSuccess, setShowSuccess] = useState(false)
  return show ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-[90%] max-w-4xl space-y-4">
        <h2 className="text-lg font-bold">Bulk Update Products</h2>

        {/* ✅ 产品列表 */}
        <div className="border rounded p-2 bg-gray-50 max-h-[150px] overflow-y-auto text-sm text-gray-700">
          {selectedProducts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 mb-3">
              <img
                src={resolveImageUrl(p.thumbnail_url || '/images/noimage.jpg')}
                alt={p.name}
                className="w-10 h-10 object-cover rounded"
              />
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">
                  {p.name} / {p.en_name}
                </span>
                <span className="text-xs text-gray-500">Stock: {p.stock}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ✅ 表单区域 */}
        <MultiFieldForm
          selectedProducts={selectedProducts}
          onClose={onClose}
          fetchProducts={fetchProducts}
          onSuccess={() => setShowSuccess(true)}
        />
      </div>
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[90%] max-w-md space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <i className="fa-solid fa-check" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Bulk Update Success</h3>
            <p className="text-sm text-gray-600">
              Products have been updated successfully.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSuccess(false)
                onClose()
              }}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null
}
