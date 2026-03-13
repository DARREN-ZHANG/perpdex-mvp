'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  position?: 'left' | 'right' | 'bottom'
  title?: string
  children: React.ReactNode
}

export function Drawer({
  isOpen,
  onClose,
  position = 'left',
  title,
  children,
}: DrawerProps) {
  // 锁定背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const positionClasses = {
    left: 'top-0 left-0 h-full w-[280px] rounded-r-lg',
    right: 'top-0 right-0 h-full w-[320px] rounded-l-lg',
    bottom: 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl',
  }

  const transformClasses = {
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    bottom: isOpen ? 'translate-y-0' : 'translate-y-full',
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩 */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        className={`absolute bg-white shadow-2xl transition-transform duration-300 ease-out ${positionClasses[position]} ${transformClasses[position]}`}
      >
        {/* 底部抽屉的拖动指示器 */}
        {position === 'bottom' && (
          <div
            className="flex justify-center pt-3 pb-1"
            onClick={onClose}
          >
            <div className="w-12 h-1.5 bg-pro-gray-300 rounded-full" />
          </div>
        )}

        {/* 头部 */}
        {(title || position !== 'bottom') && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-pro-gray-100">
            {title && (
              <h2 className="text-lg font-semibold text-pro-gray-800">{title}</h2>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-pro-gray-100 transition-colors ml-auto"
            >
              <X className="w-5 h-5 text-pro-gray-500" />
            </button>
          </div>
        )}

        {/* 内容 */}
        <div className="overflow-auto h-[calc(100%-60px)]">{children}</div>
      </div>
    </div>
  )
}
