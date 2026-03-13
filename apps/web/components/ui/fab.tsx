'use client'

import { Plus } from 'lucide-react'

interface FabProps {
  onClick: () => void
  icon?: React.ReactNode
  label?: string
  className?: string
}

export function FloatingActionButton({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  label,
  className = '',
}: FabProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed right-4 bottom-4 z-40 flex items-center justify-center gap-2
        w-14 h-14 rounded-full bg-pro-gray-900 text-white
        shadow-[0_4px_12px_rgba(0,0,0,0.3)]
        hover:bg-pro-gray-800 active:scale-95
        transition-all duration-200
        lg:hidden ${className}`}
      aria-label={label || 'Open'}
    >
      {icon}
      {label && <span className="text-sm font-medium pr-2">{label}</span>}
    </button>
  )
}
