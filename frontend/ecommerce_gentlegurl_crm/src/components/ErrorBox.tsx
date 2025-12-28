'use client'

interface ErrorBoxProps {
  error: string | null | undefined
  className?: string
}

export default function ErrorBox({ error, className = '' }: ErrorBoxProps) {
  if (!error) return null

  const errorLines = error.split('\n').filter((line) => line.trim())
  const isMultiple = errorLines.length > 1

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${className}`}>
      <div className="flex items-start gap-2">
        <i className="fa-solid fa-circle-exclamation mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          {errorLines.map((line, index) => (
            <div key={index} className="flex items-start gap-2">
              {isMultiple && <span className="text-red-500 mt-0.5">•</span>}
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

