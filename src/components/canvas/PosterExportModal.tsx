'use client'

import { downloadPosterDataUrl } from '@/lib/posterExport'

interface Props {
  title: string
  dataUrl: string | null
  error: string | null
  open: boolean
  onClose: () => void
}

export function PosterExportModal({ title, dataUrl, error, open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2118]/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#c7b58e] bg-[#fffaf0] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbcaa8] px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-bold uppercase text-[#6b8a64]">Export poster</p>
            <h2 className="font-serif text-xl font-bold text-[#34271b] sm:text-2xl">Shareable travel journal</h2>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => dataUrl && downloadPosterDataUrl(dataUrl, title)}
              disabled={!dataUrl}
              className="flex-1 rounded-full bg-[#3f3428] px-4 py-2 text-sm font-semibold text-[#fff7e7] transition hover:bg-[#5a4938] disabled:opacity-50 sm:flex-none"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-[#c7b58e] bg-white px-4 py-2 text-sm font-semibold text-[#6d5740] transition hover:bg-[#f7ead1] sm:flex-none"
            >
              Close
            </button>
          </div>
        </div>

        <div className="journal-desk min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          {error && (
            <div className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {!error && !dataUrl && (
            <div className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#6d5740]">
              Creating poster...
            </div>
          )}

          {dataUrl && (
            <div className="mx-auto w-full max-w-[360px] sm:max-w-[460px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUrl} alt="Travel poster preview" className="w-full rounded-lg border border-[#c7b58e] bg-white shadow-2xl" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
