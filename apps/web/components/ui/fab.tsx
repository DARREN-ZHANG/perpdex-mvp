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
      className={`fixed right-4 bottom-6 z-40 flex items-center gap-2
        h-14 px-4 rounded-full bg-pro-accent-cyan text-white
        shadow-[0_4px_16px_rgba(14,165,233,0.4)]
        hover:bg-pro-accent-cyan/90 active:scale-95
        transition-all duration-200 whitespace-nowrap
        lg:hidden ${className}`}
      aria-label={label || 'Open'}
    >
      {icon}
      {label && <span className="text-base font-semibold whitespace-nowrap">{label}</span>}
    </button>
  )
}
