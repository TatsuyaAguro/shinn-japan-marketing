'use client'

import type { TouristResource } from '@/lib/types/strategy'
import { CATEGORY_META } from '@/lib/types/strategy'

const STARS = [1, 2, 3, 4, 5]

export default function ResourcesSection({ resources }: { resources: TouristResource[] }) {
  if (resources.length === 0) {
    return (
      <EmptyState message="AIとの会話を進めると、地域の観光資源がここに表示されます。" />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {resources.map(r => {
        const meta = CATEGORY_META[r.category] ?? { icon: '📍', color: 'bg-slate-50 text-slate-600 border-slate-200' }
        return (
          <div
            key={r.id}
            className="group bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.color}`}>
                {meta.icon} {r.category}
              </span>
              <div className="flex items-center gap-0.5" title={`ユニークさ: ${r.uniquenessScore}/5`}>
                {STARS.map(s => (
                  <svg
                    key={s}
                    className={`w-3 h-3 ${s <= r.uniquenessScore ? 'text-amber-400' : 'text-slate-200'}`}
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1.5">{r.name}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{r.description}</p>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
