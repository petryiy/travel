'use client'

import type { CanvasTab } from '@/types/travel'

interface Props {
  activeTab: CanvasTab
  onSwitch: (tab: CanvasTab) => void
  disabled: boolean
}

const TABS: { id: CanvasTab; label: string; icon: string }[] = [
  { id: 'itinerary', label: 'Itinerary', icon: '🗺️' },
  { id: 'hotels', label: 'Hotels', icon: '🏨' },
  { id: 'flights', label: 'Flights', icon: '✈️' },
]

export function CanvasTabBar({ activeTab, onSwitch, disabled }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-[#dfd4c5] bg-[#fbf7ef]">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => !disabled && onSwitch(tab.id)}
            disabled={disabled}
            className={[
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all select-none',
              isActive
                ? 'bg-[#5f7d59] text-white shadow-sm'
                : 'bg-[#f4efe7] text-[#5a4a3a] hover:bg-[#ece5d8] border border-[#dfd4c5]',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <span className="text-xs leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
