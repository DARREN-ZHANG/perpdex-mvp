'use client'

import { useCallback } from 'react'

interface LeverageSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

const LEVERAGE_MARKS = [1, 5, 10, 15, 20]

export function LeverageSlider({
  value,
  onChange,
  min = 1,
  max = 20,
}: LeverageSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])

  return (
    <div className="mt-3">
      <div className="relative h-1 bg-pro-gray-200 rounded">
        <div
          className="absolute h-full bg-pro-accent-cyan rounded"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          className="absolute w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-pro-accent-cyan rounded-full border-2 border-white shadow"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs text-pro-gray-500">
        {LEVERAGE_MARKS.map((mark) => (
          <span
            key={mark}
            className={`cursor-pointer hover:text-pro-accent-cyan transition-colors ${
              value === mark ? 'text-pro-accent-cyan font-medium' : ''
            }`}
            onClick={() => onChange(mark)}
          >
            {mark}x
          </span>
        ))}
      </div>
    </div>
  )
}
